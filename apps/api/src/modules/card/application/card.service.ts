import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { CardChargeStatus, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { sha256Hex } from '../../../common/crypto/tokens';
import { type MoneyView, money, moneyView, round2 } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { mercadoPagoSignatureValid } from '../../pix/domain/pix-provider';
import { OrdersService } from '../../store/application/orders.service';
import {
  type CardPaymentResult,
  type CardPaymentType,
  type CardProvider,
  cardMethodCode,
  effectiveInterestFree,
  interestFreeLimit,
  MAX_INSTALLMENTS,
  parseDifferentialPricing,
  rejectionMessage
} from '../domain/card-payment';
import { MercadoPagoCardProvider, SandboxCardProvider } from '../infrastructure/card-providers';

export type CardOwner =
  { readonly userId: string } | { readonly orderNumber: string; readonly code: string };

/** O que a tela do cartão precisa para montar o formulário do intermediário. */
export interface CardCheckoutView {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amount: MoneyView;
  readonly maxInstallments: number;
  /** Parcelas sem juros (0 = todas com juros pagos pelo comprador). */
  readonly interestFreeUpTo: number;
  readonly publicKey: string | null;
  readonly simulated: boolean;
  readonly payerEmail: string | null;
}

export interface CardPayInput {
  readonly token: string;
  readonly paymentMethodId: string;
  readonly issuerId?: string;
  readonly installments: number;
  readonly paymentType: CardPaymentType;
  readonly payerEmail?: string;
  readonly identificationType?: string;
  readonly identificationNumber?: string;
}

export interface CardChargeView {
  readonly id: string;
  readonly status: CardChargeStatus;
  readonly amount: MoneyView;
  readonly installments: number;
  readonly interestFree: boolean;
  readonly paymentType: string;
  readonly brand: string | null;
  readonly lastFour: string | null;
  /** Recusado: o motivo em português, para tentar outro cartão. */
  readonly message: string | null;
  readonly paidAt: string | null;
}

export interface CardAdminView {
  readonly provider: string;
  readonly enabled: boolean;
  /** Códigos de "preço diferenciado" do intermediário, por N parcelas sem juros (PEN-067). */
  readonly differentialPricing: { installments: number; id: string }[];
  readonly review: {
    id: string;
    reference: string;
    amount: MoneyView;
    paidAt: string | null;
    reason: string | null;
  }[];
  readonly refundFailures: {
    refundId: string;
    reference: string;
    amount: MoneyView;
    error: string | null;
  }[];
}

type ChargeRow = Prisma.CardChargeGetPayload<object>;

const RECHECK_MS = 10_000;
const REFUND_SENT = 'SENT';
const REFUND_FAILED = 'FAILED';

/**
 * Cartão pelo site (DT-079): o formulário é do intermediário (os dados do cartão não passam
 * pelo clube); aprovado baixa no Caixa como cartão de crédito ou débito; estorno do pedido
 * vai ao intermediário por uma fila. Até 12x, juros do parcelado pagos pelo comprador.
 */
@Injectable()
export class CardService implements OnModuleInit {
  private readonly logger = new Logger('Cartao');
  private readonly provider: CardProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: OrdersService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly jobs: JobScheduler,
    private readonly config: AppConfig
  ) {
    const card = config.values.card;

    this.provider =
      card.provider === 'sandbox'
        ? new SandboxCardProvider()
        : card.provider === 'mercadopago' && card.accessToken
          ? new MercadoPagoCardProvider(card.accessToken, card.notificationUrl)
          : null;
  }

  onModuleInit(): void {
    // Em análise no banco: confere a cada 2 minutos. Estornos do Caixa vão ao intermediário.
    this.jobs.every('card.sync', 2 * 60_000, async () => {
      await this.syncPending();
      await this.sendRefunds();
    });
  }

  availability(): { enabled: boolean; simulated: boolean; maxInstallments: number } {
    return {
      enabled: this.provider !== null,
      simulated: this.provider?.name === 'sandbox',
      maxInstallments: MAX_INSTALLMENTS
    };
  }

  private enabledProvider(): CardProvider {
    if (this.provider === null) {
      throw AppError.conflict(
        'CARD_DISABLED',
        'Pagamento com cartão pelo site desligado. Use o PIX ou fale com a diretoria.'
      );
    }

    return this.provider;
  }

  private view(row: ChargeRow): CardChargeView {
    return {
      id: row.id,
      status: row.status,
      amount: moneyView(row.amount, row.currency),
      installments: row.installments,
      interestFree: row.interestFree,
      paymentType: row.paymentType,
      brand: row.brand,
      lastFour: row.lastFour,
      message:
        row.status === 'REJECTED'
          ? rejectionMessage(row.statusDetail)
          : row.status === 'PENDING'
            ? 'Pagamento em análise pelo banco. Avisamos quando for aprovado.'
            : null,
      paidAt: row.paidAt?.toISOString() ?? null
    };
  }

  private async findOrder(owner: CardOwner, orderId?: string) {
    const order = await this.prisma.order.findFirst({
      where:
        'userId' in owner
          ? { id: orderId ?? '', customerUserId: owner.userId }
          : {
              orderNumber: owner.orderNumber.trim().toUpperCase(),
              guestAccessTokenHash: sha256Hex(`order:${owner.code.trim()}`)
            },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        customerEmail: true,
        payments: { select: { status: true, amount: true } },
        items: { select: { product: { select: { interestFreeInstallments: true } } } }
      }
    });

    if (order === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'CREATED') {
      throw AppError.conflict('ORDER_NOT_PAYABLE', 'Este pedido não está aguardando pagamento.');
    }

    const used = order.payments
      .filter((p) => p.status === 'CONFIRMED' || p.status === 'PENDING')
      .reduce((total, p) => total.plus(p.amount), money(0));
    const amount = round2(money(order.totalAmount).minus(used));

    if (amount.lte(0)) {
      throw AppError.conflict(
        'ALREADY_COVERED',
        'O pedido já tem pagamento registrado em análise.'
      );
    }

    return { order, amount };
  }

  private async interestFree(
    rules: readonly (number | null)[]
  ): Promise<{ upTo: number; differentialPricingId: string | null }> {
    const settings = await this.prisma.teamSettings.findFirst({
      select: { cardDifferentialPricing: true }
    });

    return effectiveInterestFree(
      interestFreeLimit(rules),
      parseDifferentialPricing(settings?.cardDifferentialPricing ?? null),
      this.provider?.name === 'sandbox'
    );
  }

  /** Dados do formulário: valor que falta, até 12x e quantas sem juros. */
  async checkout(owner: CardOwner, orderId?: string): Promise<CardCheckoutView> {
    this.enabledProvider();

    const { order, amount } = await this.findOrder(owner, orderId);
    const free = await this.interestFree(
      order.items.map((item) => item.product.interestFreeInstallments)
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: moneyView(amount, order.currency),
      maxInstallments: MAX_INSTALLMENTS,
      interestFreeUpTo: free.upTo,
      publicKey: this.config.values.card.publicKey,
      simulated: this.provider?.name === 'sandbox',
      payerEmail: order.customerEmail
    };
  }

  /**
   * Paga com o token do formulário. A chamada ao intermediário fica fora da transação; a
   * baixa (aprovado) e o registro da cobrança ficam dentro, travando o pedido.
   */
  async pay(
    owner: CardOwner,
    input: CardPayInput,
    idempotencyKey: string,
    orderId?: string
  ): Promise<CardChargeView> {
    const provider = this.enabledProvider();
    const { order, amount } = await this.findOrder(owner, orderId);

    if (input.installments < 1 || input.installments > MAX_INSTALLMENTS) {
      throw AppError.validation('INVALID_INSTALLMENTS', 'Escolha de 1 a 12 parcelas.');
    }

    if (input.paymentType === 'debit_card' && input.installments !== 1) {
      throw AppError.validation('DEBIT_ONE_INSTALLMENT', 'Débito é só à vista (1 parcela).');
    }

    if (
      (await this.prisma.cardCharge.count({ where: { orderId: order.id, status: 'PENDING' } })) > 0
    ) {
      throw AppError.conflict(
        'CARD_IN_ANALYSIS',
        'Já há um pagamento com cartão em análise neste pedido. Aguarde a resposta do banco.'
      );
    }

    const free = await this.interestFree(
      order.items.map((item) => item.product.interestFreeInstallments)
    );
    const interestFree = input.installments === 1 || input.installments <= free.upTo;
    const result = await provider.pay({
      amount: amount.toFixed(2),
      token: input.token,
      paymentMethodId: input.paymentMethodId,
      issuerId: input.issuerId ?? null,
      installments: input.installments,
      paymentType: input.paymentType,
      payerEmail: input.payerEmail ?? order.customerEmail ?? 'comprador@fenix.example',
      identification:
        input.identificationType && input.identificationNumber
          ? { type: input.identificationType, number: input.identificationNumber }
          : null,
      description: `Pedido ${order.orderNumber} — Fênix Vôlei`,
      externalReference: order.id,
      idempotencyKey: `card:${order.id}:${idempotencyKey}`.slice(0, 64),
      differentialPricingId:
        input.installments > 1 && input.installments <= free.upTo
          ? free.differentialPricingId
          : null
    });
    const existing = await this.prisma.cardCharge.findUnique({
      where: {
        provider_providerPaymentId: {
          provider: provider.name,
          providerPaymentId: result.providerPaymentId
        }
      }
    });
    const charge =
      existing ??
      (await this.prisma.cardCharge.create({
        data: {
          provider: provider.name,
          providerPaymentId: result.providerPaymentId,
          orderId: order.id,
          amount,
          currency: order.currency,
          installments: input.installments,
          paymentType: result.paymentType,
          brand: result.brand,
          lastFour: result.lastFour,
          interestFree,
          status: result.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
          statusDetail: result.statusDetail
        }
      }));

    await this.audit.record({
      actorUserId: 'userId' in owner ? owner.userId : null,
      action: `card.charge.${result.status.toLowerCase()}`,
      entityType: 'CardCharge',
      entityId: charge.id,
      after: {
        orderId: order.id,
        amount: amount.toFixed(2),
        installments: input.installments,
        paymentType: result.paymentType
      }
    });

    if (result.status === 'APPROVED') {
      return this.view(await this.settle(charge.id, result));
    }

    return this.view(charge);
  }

  /** Aprovado: baixa uma vez só; pedido que não aguardava mais vai para revisão. */
  private async settle(chargeId: string, result: CardPaymentResult): Promise<ChargeRow> {
    const review = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'cardCharge', chargeId);
      const fresh = await tx.cardCharge.findUniqueOrThrow({ where: { id: chargeId } });

      if (fresh.status !== 'PENDING') {
        return null;
      }

      const paidAt = result.paidAt ?? new Date();
      const amount = result.paidAmount ?? fresh.amount.toFixed(2);
      const account = await this.receivingAccount(tx);
      const receipt =
        account === null
          ? { ok: false as const, reason: 'Nenhuma conta do Caixa configurada para o cartão.' }
          : await this.orders.receivePixInTx(tx, fresh.orderId, {
              amount: money(amount),
              paidAt,
              accountId: account,
              provider: `${fresh.provider}-card`,
              reference: fresh.providerPaymentId,
              methodCode: cardMethodCode(result.paymentType),
              notes: `Cartão pelo site · ${fresh.installments}x${fresh.lastFour ? ` · final ${fresh.lastFour}` : ''}`
            });

      await tx.cardCharge.update({
        where: { id: chargeId },
        data: receipt.ok
          ? { status: 'PAID', paidAt, paymentId: receipt.paymentId, lastCheckedAt: new Date() }
          : { status: 'REVIEW', paidAt, reviewReason: receipt.reason, lastCheckedAt: new Date() }
      });
      await this.audit.record(
        {
          actorUserId: null,
          action: receipt.ok ? 'card.charge.paid' : 'card.charge.review',
          entityType: 'CardCharge',
          entityId: chargeId,
          after: receipt.ok
            ? { paymentId: receipt.paymentId, amount }
            : { reason: receipt.reason, amount }
        },
        tx
      );

      return receipt.ok ? null : receipt.reason;
    });

    if (review) {
      await this.staffAlerts.alert(PERMISSIONS.paymentsConfirm, {
        type: 'staff.card.review',
        title: 'Pagamento com cartão para revisar',
        message: review,
        link: '/admin/pix',
        key: `staff-card-review:${chargeId}`
      });
    }

    return this.prisma.cardCharge.findUniqueOrThrow({ where: { id: chargeId } });
  }

  /** Conta do Caixa do intermediário: a mesma do PIX automático (mesma conta do Mercado Pago). */
  private async receivingAccount(tx: Prisma.TransactionClient): Promise<string | null> {
    const settings = await tx.teamSettings.findFirst({ select: { pixAccountId: true } });
    const chosen = settings?.pixAccountId
      ? await tx.financialAccount.findFirst({
          where: { id: settings.pixAccountId, deletedAt: null, isActive: true },
          select: { id: true }
        })
      : null;

    if (chosen) {
      return chosen.id;
    }

    const fallback = await tx.financialAccount.findFirst({
      where: { code: 'conta-pix', deletedAt: null, isActive: true },
      select: { id: true }
    });

    return fallback?.id ?? null;
  }

  private async ownedCharge(owner: CardOwner, chargeId: string): Promise<ChargeRow> {
    const charge = await this.prisma.cardCharge.findUnique({ where: { id: chargeId } });
    const allowed =
      charge !== null &&
      (await this.prisma.order.count({
        where:
          'userId' in owner
            ? { id: charge.orderId, customerUserId: owner.userId }
            : {
                id: charge.orderId,
                orderNumber: owner.orderNumber.trim().toUpperCase(),
                guestAccessTokenHash: sha256Hex(`order:${owner.code.trim()}`)
              }
      })) > 0;

    if (!allowed || charge === null) {
      throw AppError.notFound('Pagamento com cartão não encontrado.');
    }

    return charge;
  }

  /** Situação para a tela (em análise: consulta o intermediário no máximo a cada 10 s). */
  async status(
    owner: CardOwner,
    chargeId: string,
    now: Date = new Date()
  ): Promise<CardChargeView> {
    let charge = await this.ownedCharge(owner, chargeId);

    if (
      charge.status === 'PENDING' &&
      (!charge.lastCheckedAt || now.getTime() - charge.lastCheckedAt.getTime() > RECHECK_MS)
    ) {
      charge = await this.sync(charge.id, now);
    }

    return this.view(charge);
  }

  /** Confere no intermediário a cobrança em análise e baixa se aprovada. */
  async sync(chargeId: string, now: Date = new Date()): Promise<ChargeRow> {
    const charge = await this.prisma.cardCharge.findUniqueOrThrow({ where: { id: chargeId } });

    if (
      charge.status !== 'PENDING' ||
      this.provider === null ||
      charge.provider !== this.provider.name
    ) {
      return charge;
    }

    let remote: CardPaymentResult;

    try {
      remote = await this.provider.fetch(charge.providerPaymentId);
    } catch {
      return this.prisma.cardCharge.update({
        where: { id: chargeId },
        data: { lastCheckedAt: now }
      });
    }

    if (remote.status === 'APPROVED') {
      return this.settle(chargeId, remote);
    }

    return this.prisma.cardCharge.update({
      where: { id: chargeId },
      data:
        remote.status === 'PENDING'
          ? { lastCheckedAt: now }
          : {
              status: remote.status === 'REJECTED' ? 'REJECTED' : 'CANCELLED',
              statusDetail: remote.statusDetail,
              lastCheckedAt: now
            }
    });
  }

  async syncPending(now: Date = new Date()): Promise<number> {
    const pending = await this.prisma.cardCharge.findMany({
      where: { status: 'PENDING' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    for (const { id } of pending) {
      try {
        await this.sync(id, now);
      } catch (error) {
        this.logger.warn(
          `Falha ao conferir cartão: ${error instanceof Error ? error.name : 'erro'}.`
        );
      }
    }

    return pending.length;
  }

  /** Aviso do intermediário: assinatura conferida, repetidos ignorados, situação buscada lá. */
  async webhook(
    providerName: string,
    input: {
      signature: string | undefined;
      requestId: string | undefined;
      dataId: string | undefined;
    }
  ): Promise<{ received: true }> {
    const card = this.config.values.card;

    if (providerName !== 'mercadopago' || card.provider !== 'mercadopago' || !card.webhookSecret) {
      throw AppError.notFound('Aviso não reconhecido.');
    }

    if (
      !mercadoPagoSignatureValid({
        signatureHeader: input.signature,
        requestId: input.requestId,
        dataId: input.dataId,
        secret: card.webhookSecret
      })
    ) {
      throw AppError.unauthorized('Assinatura do aviso inválida.');
    }

    const first = await this.prisma.pixWebhookEvent.createMany({
      data: [
        {
          provider: `${providerName}-card`,
          eventKey: `${input.dataId}:${input.requestId}`.slice(0, 160),
          result: 'RECEIVED'
        }
      ],
      skipDuplicates: true
    });

    if (first.count > 0) {
      const charge = await this.prisma.cardCharge.findUnique({
        where: {
          provider_providerPaymentId: {
            provider: providerName,
            providerPaymentId: input.dataId ?? ''
          }
        },
        select: { id: true }
      });

      if (charge) {
        await this.sync(charge.id);
      }
    }

    return { received: true };
  }

  /**
   * Fila de estornos (DT-079): todo reembolso do Caixa ligado a um pagamento com cartão vai
   * ao intermediário uma vez (chave de idempotência = id do reembolso). Falha avisa a diretoria.
   */
  async sendRefunds(): Promise<number> {
    if (this.provider === null) {
      return 0;
    }

    const refunds = await this.prisma.refund.findMany({
      where: {
        providerRefundStatus: null,
        status: 'COMPLETED',
        payment: { cardCharge: { provider: this.provider.name } }
      },
      select: {
        id: true,
        amount: true,
        payment: { select: { cardCharge: { select: { providerPaymentId: true, orderId: true } } } }
      },
      take: 50
    });

    for (const refund of refunds) {
      const charge = refund.payment.cardCharge;

      if (!charge) {
        continue;
      }

      try {
        const id = await this.provider.refund(
          charge.providerPaymentId,
          money(refund.amount).toFixed(2),
          `refund:${refund.id}`
        );

        await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            providerRefundStatus: REFUND_SENT,
            providerRefundId: id,
            providerRefundError: null
          }
        });
      } catch (error) {
        await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            providerRefundStatus: REFUND_FAILED,
            providerRefundError: error instanceof AppError ? error.message : 'Falha ao estornar.'
          }
        });
        await this.staffAlerts.alert(PERMISSIONS.paymentsCorrect, {
          type: 'staff.card.refund_failed',
          title: 'Estorno de cartão não enviado',
          message: 'Estorne pelo painel do Mercado Pago e marque como resolvido em PIX e cartão.',
          link: '/admin/pix',
          key: `staff-card-refund:${refund.id}`
        });
      }
    }

    return refunds.length;
  }

  // ---------- Diretoria ----------

  async admin(): Promise<CardAdminView> {
    const [settings, review, failures] = await Promise.all([
      this.prisma.teamSettings.findFirst({ select: { cardDifferentialPricing: true } }),
      this.prisma.cardCharge.findMany({
        where: { status: 'REVIEW' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { order: { select: { orderNumber: true } } }
      }),
      this.prisma.refund.findMany({
        where: { providerRefundStatus: REFUND_FAILED },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          amount: true,
          currency: true,
          providerRefundError: true,
          order: { select: { orderNumber: true } }
        }
      })
    ]);

    return {
      provider: this.config.values.card.provider,
      enabled: this.provider !== null,
      differentialPricing: [
        ...parseDifferentialPricing(settings?.cardDifferentialPricing ?? null).entries()
      ]
        .sort(([a], [b]) => a - b)
        .map(([installments, id]) => ({ installments, id })),
      review: review.map((row) => ({
        id: row.id,
        reference: `Pedido ${row.order.orderNumber}`,
        amount: moneyView(row.amount, row.currency),
        paidAt: row.paidAt?.toISOString() ?? null,
        reason: row.reviewReason
      })),
      refundFailures: failures.map((row) => ({
        refundId: row.id,
        reference: row.order ? `Pedido ${row.order.orderNumber}` : '—',
        amount: moneyView(row.amount, row.currency),
        error: row.providerRefundError
      }))
    };
  }

  /** Códigos de preço diferenciado do Mercado Pago (PEN-067): { parcelas: código }. */
  async setDifferentialPricing(
    actor: Principal,
    entries: readonly { installments: number; id: string }[],
    meta: RequestMeta
  ): Promise<CardAdminView> {
    const value = Object.fromEntries(
      entries
        .filter((entry) => entry.id.trim())
        .map((entry) => [String(entry.installments), entry.id.trim()])
    );

    if (parseDifferentialPricing(value).size !== Object.keys(value).length) {
      throw AppError.validation('INVALID_CODES', 'Parcelas de 2 a 12, uma vez cada.');
    }

    const settings = await this.prisma.teamSettings.findFirstOrThrow({ select: { id: true } });

    await this.prisma.teamSettings.update({
      where: { id: settings.id },
      data: { cardDifferentialPricing: value }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'card.differential_pricing.set',
      entityType: 'TeamSettings',
      entityId: settings.id,
      after: { installments: Object.keys(value) },
      meta
    });

    return this.admin();
  }

  /** Revisão ou estorno resolvido fora do sistema (painel do intermediário). */
  async resolve(
    actor: Principal,
    target: { chargeId?: string; refundId?: string },
    reason: string,
    meta: RequestMeta
  ): Promise<CardAdminView> {
    const { count } = target.chargeId
      ? await this.prisma.cardCharge.updateMany({
          where: { id: target.chargeId, status: 'REVIEW' },
          data: { status: 'CANCELLED', reviewReason: reason }
        })
      : await this.prisma.refund.updateMany({
          where: { id: target.refundId ?? '', providerRefundStatus: REFUND_FAILED },
          data: { providerRefundStatus: 'MANUAL', providerRefundError: reason }
        });

    if (count === 0) {
      throw AppError.notFound('Item para resolver não encontrado.');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'card.review.resolved',
      entityType: target.chargeId ? 'CardCharge' : 'Refund',
      entityId: target.chargeId ?? target.refundId ?? '',
      reason,
      meta
    });

    return this.admin();
  }
}
