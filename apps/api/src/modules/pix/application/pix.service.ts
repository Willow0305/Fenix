import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { PixChargeStatus, Prisma } from '../../../generated/prisma/client';
import QRCode from 'qrcode';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { sha256Hex } from '../../../common/crypto/tokens';
import { type MoneyView, money, moneyView, round2 } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { FeesService } from '../../finance/application/fees.service';
import { lockRow } from '../../finance/application/ledger.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { OrdersService } from '../../store/application/orders.service';
import { mercadoPagoSignatureValid, type PixProvider } from '../domain/pix-provider';
import { MercadoPagoPixProvider, SandboxPixProvider } from '../infrastructure/pix-providers';

/** Mensalidade: QR vale 24 h; pedido: enquanto a reserva valer (DT-071). */
const FEE_TTL_MS = 24 * 3_600_000;
/** O Mercado Pago exige ao menos 30 minutos de validade. */
const MIN_TTL_MS = 30 * 60_000;
const RECHECK_MS = 10_000;

export type PixOwner =
  { readonly userId: string } | { readonly orderNumber: string; readonly code: string };

export interface PixChargeView {
  readonly id: string;
  readonly status: PixChargeStatus;
  readonly amount: MoneyView;
  readonly qrCode: string;
  readonly qrSvg: string;
  readonly expiresAt: string;
  readonly paidAt: string | null;
  /** Modo de teste: mostra o botão "Simular pagamento". */
  readonly simulated: boolean;
}

export interface PixAdminView {
  readonly provider: string;
  readonly enabled: boolean;
  readonly accountId: string | null;
  readonly review: {
    id: string;
    purpose: 'ORDER' | 'MONTHLY_FEE';
    reference: string;
    amount: MoneyView;
    paidAt: string | null;
    reason: string | null;
  }[];
}

type ChargeRow = Prisma.PixChargeGetPayload<object>;

/**
 * PIX automático (DT-071): QR do intermediário para pedido e mensalidade; ao confirmar o
 * pagamento (aviso ou conferência periódica), baixa e lança no Caixa sem pessoa da diretoria.
 * Pago fora do esperado (pedido cancelado, valor diferente) vai para revisão, nunca some.
 */
@Injectable()
export class PixService implements OnModuleInit {
  private readonly logger = new Logger('PixAutomatico');
  private readonly provider: PixProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: OrdersService,
    private readonly fees: FeesService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly jobs: JobScheduler,
    private readonly config: AppConfig
  ) {
    const pix = config.values.pix;

    this.provider =
      pix.provider === 'sandbox'
        ? new SandboxPixProvider(prisma)
        : pix.provider === 'mercadopago' && pix.accessToken
          ? new MercadoPagoPixProvider(pix.accessToken, pix.notificationUrl)
          : null;
  }

  onModuleInit(): void {
    // Aviso perdido não fica sem baixa: confere as pendentes a cada 2 minutos.
    this.jobs.every('pix.sync', 2 * 60_000, async () => {
      await this.syncPending();
    });
  }

  availability(): { enabled: boolean; simulated: boolean } {
    return { enabled: this.provider !== null, simulated: this.provider?.name === 'sandbox' };
  }

  private enabledProvider(): PixProvider {
    if (this.provider === null) {
      throw AppError.conflict(
        'PIX_DISABLED',
        'PIX automático desligado. Use o PIX com comprovante.'
      );
    }

    return this.provider;
  }

  private async view(row: ChargeRow): Promise<PixChargeView> {
    return {
      id: row.id,
      status: row.status,
      amount: moneyView(row.amount, row.currency),
      qrCode: row.qrCode,
      qrSvg: await QRCode.toString(row.qrCode, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1
      }),
      expiresAt: row.expiresAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      simulated: row.provider === 'sandbox'
    };
  }

  // ---------- Gerar cobrança ----------

  private async findOrder(owner: PixOwner, orderId?: string) {
    const order = await this.prisma.order.findFirst({
      where:
        'userId' in owner
          ? { id: orderId ?? '', customerUserId: owner.userId }
          : {
              orderNumber: owner.orderNumber.toUpperCase(),
              guestAccessTokenHash: sha256Hex(`order:${owner.code}`)
            },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        customerEmail: true,
        reservationExpiresAt: true,
        payments: { select: { status: true, amount: true } }
      }
    });

    if (order === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    return order;
  }

  /** QR PIX do pedido; reaproveita o que ainda vale. */
  async forOrder(
    owner: PixOwner,
    orderId?: string,
    now: Date = new Date()
  ): Promise<PixChargeView> {
    const provider = this.enabledProvider();
    const order = await this.findOrder(owner, orderId);

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

    // O intermediário exige QR de pelo menos 30 minutos: se a reserva acaba antes (pedido PIX
    // tem 30 minutos, DT-076), ela acompanha o QR e os dois terminam juntos.
    const reserved = order.reservationExpiresAt ?? new Date(now.getTime() + FEE_TTL_MS);
    const minimum = new Date(now.getTime() + MIN_TTL_MS + 60_000);
    const expiresAt = reserved < minimum ? minimum : reserved;

    if (order.reservationExpiresAt !== null && expiresAt > order.reservationExpiresAt) {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: 'AWAITING_PAYMENT' },
        data: { reservationExpiresAt: expiresAt }
      });
    }

    return this.reuseOrCreate(provider, {
      purpose: 'ORDER',
      orderId: order.id,
      amount: amount.toFixed(2),
      currency: order.currency,
      expiresAt,
      description: `Pedido ${order.orderNumber} — Fênix Vôlei`,
      payerEmail: order.customerEmail,
      now
    });
  }

  /** QR PIX da mensalidade do próprio atleta, válido por 24 horas. */
  async forFee(userId: string, feeId: string, now: Date = new Date()): Promise<PixChargeView> {
    const provider = this.enabledProvider();
    const fee = await this.prisma.monthlyFee.findFirst({
      where: { id: feeId, athlete: { userId, deletedAt: null } },
      select: {
        id: true,
        status: true,
        currency: true,
        referenceMonth: true,
        athlete: { select: { user: { select: { email: true } } } }
      }
    });

    if (fee === null) {
      throw AppError.notFound('Mensalidade não encontrada.');
    }

    if (fee.status === 'CANCELLED' || fee.status === 'PAID') {
      throw AppError.conflict('FEE_NOT_PAYABLE', 'Esta mensalidade não está em aberto.');
    }

    const amount = await this.prisma.$transaction((tx) => this.fees.outstandingInTx(tx, feeId));

    if (money(amount).lte(0)) {
      throw AppError.conflict('ALREADY_COVERED', 'A mensalidade já tem pagamento em análise.');
    }

    const month = fee.referenceMonth.toISOString().slice(0, 7);

    return this.reuseOrCreate(provider, {
      purpose: 'MONTHLY_FEE',
      monthlyFeeId: fee.id,
      amount: round2(money(amount)).toFixed(2),
      currency: fee.currency,
      expiresAt: new Date(now.getTime() + FEE_TTL_MS),
      description: `Mensalidade ${month.slice(5, 7)}/${month.slice(0, 4)} — Fênix Vôlei`,
      payerEmail: fee.athlete.user?.email ?? null,
      now
    });
  }

  private async reuseOrCreate(
    provider: PixProvider,
    input: {
      purpose: 'ORDER' | 'MONTHLY_FEE';
      orderId?: string;
      monthlyFeeId?: string;
      amount: string;
      currency: string;
      expiresAt: Date;
      description: string;
      payerEmail: string | null;
      now: Date;
    }
  ): Promise<PixChargeView> {
    const existing = await this.prisma.pixCharge.findFirst({
      where: {
        provider: provider.name,
        status: 'PENDING',
        ...(input.orderId
          ? { orderId: input.orderId }
          : { monthlyFeeId: input.monthlyFeeId ?? '' }),
        amount: input.amount,
        expiresAt: { gt: new Date(input.now.getTime() + 60_000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existing) {
      return this.view(existing);
    }

    const reference = randomUUID();
    const created = await provider.createCharge({
      amount: input.amount,
      description: input.description,
      externalReference: reference,
      expiresAt: input.expiresAt,
      payerEmail: input.payerEmail,
      idempotencyKey: reference
    });
    const row = await this.prisma.pixCharge.create({
      data: {
        id: reference,
        provider: provider.name,
        providerChargeId: created.providerChargeId,
        purpose: input.purpose,
        orderId: input.orderId ?? null,
        monthlyFeeId: input.monthlyFeeId ?? null,
        amount: input.amount,
        currency: input.currency,
        qrCode: created.qrCode,
        expiresAt: created.expiresAt
      }
    });

    return this.view(row);
  }

  // ---------- Situação e baixa ----------

  private async ownedCharge(owner: PixOwner, chargeId: string): Promise<ChargeRow> {
    const charge = await this.prisma.pixCharge.findUnique({ where: { id: chargeId } });

    if (charge === null) {
      throw AppError.notFound('Cobrança PIX não encontrada.');
    }

    const allowed =
      'userId' in owner
        ? (charge.orderId &&
            (await this.prisma.order.count({
              where: { id: charge.orderId, customerUserId: owner.userId }
            })) > 0) ||
          (charge.monthlyFeeId &&
            (await this.prisma.monthlyFee.count({
              where: { id: charge.monthlyFeeId, athlete: { userId: owner.userId } }
            })) > 0)
        : charge.orderId &&
          (await this.prisma.order.count({
            where: {
              id: charge.orderId,
              orderNumber: owner.orderNumber.toUpperCase(),
              guestAccessTokenHash: sha256Hex(`order:${owner.code}`)
            }
          })) > 0;

    if (!allowed) {
      throw AppError.notFound('Cobrança PIX não encontrada.');
    }

    return charge;
  }

  /** Situação para a tela que mostra o QR (consulta o intermediário no máximo a cada 10 s). */
  async status(owner: PixOwner, chargeId: string, now: Date = new Date()): Promise<PixChargeView> {
    let charge = await this.ownedCharge(owner, chargeId);

    if (
      charge.status === 'PENDING' &&
      (!charge.lastCheckedAt || now.getTime() - charge.lastCheckedAt.getTime() > RECHECK_MS)
    ) {
      charge = await this.sync(charge.id, now);
    }

    return this.view(charge);
  }

  /** Modo de teste: simula o pagamento e processa como um aviso real. */
  async simulatePay(owner: PixOwner, chargeId: string): Promise<PixChargeView> {
    const charge = await this.ownedCharge(owner, chargeId);

    if (charge.provider !== 'sandbox' || this.config.values.isProduction) {
      throw AppError.notFound('Cobrança PIX não encontrada.');
    }

    await this.prisma.pixCharge.update({
      where: { id: chargeId },
      data: { simulatedPaidAt: new Date() }
    });

    return this.view(await this.sync(chargeId));
  }

  /** Aviso do intermediário: confere a assinatura, ignora repetidos e busca a situação real. */
  async webhook(
    providerName: string,
    input: {
      signature: string | undefined;
      requestId: string | undefined;
      dataId: string | undefined;
    }
  ): Promise<{ received: true }> {
    const pix = this.config.values.pix;

    if (providerName !== 'mercadopago' || pix.provider !== 'mercadopago' || !pix.webhookSecret) {
      throw AppError.notFound('Aviso não reconhecido.');
    }

    if (
      !mercadoPagoSignatureValid({
        signatureHeader: input.signature,
        requestId: input.requestId,
        dataId: input.dataId,
        secret: pix.webhookSecret
      })
    ) {
      throw AppError.unauthorized('Assinatura do aviso inválida.');
    }

    const eventKey = `${input.dataId}:${input.requestId}`.slice(0, 160);
    const first = await this.prisma.pixWebhookEvent.createMany({
      data: [{ provider: providerName, eventKey, result: 'RECEIVED' }],
      skipDuplicates: true
    });

    if (first.count === 0) {
      return { received: true };
    }

    const charge = await this.prisma.pixCharge.findUnique({
      where: {
        provider_providerChargeId: { provider: providerName, providerChargeId: input.dataId ?? '' }
      },
      select: { id: true }
    });

    if (charge) {
      await this.sync(charge.id);
    }

    return { received: true };
  }

  /** Confere a cobrança no intermediário e, se paga, faz a baixa (uma vez só). */
  async sync(chargeId: string, now: Date = new Date()): Promise<ChargeRow> {
    const charge = await this.prisma.pixCharge.findUniqueOrThrow({ where: { id: chargeId } });

    if (
      charge.status !== 'PENDING' ||
      this.provider === null ||
      charge.provider !== this.provider.name
    ) {
      return charge;
    }

    let remote;

    try {
      remote = await this.provider.fetchStatus(charge.providerChargeId);
    } catch {
      return this.prisma.pixCharge.update({
        where: { id: chargeId },
        data: { lastCheckedAt: now }
      });
    }

    if (remote.status === 'PENDING') {
      return this.prisma.pixCharge.update({
        where: { id: chargeId },
        data: { lastCheckedAt: now }
      });
    }

    if (remote.status !== 'PAID') {
      return this.prisma.pixCharge.update({
        where: { id: chargeId },
        data: { status: remote.status, lastCheckedAt: now }
      });
    }

    const review = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'pixCharge', chargeId);
      const fresh = await tx.pixCharge.findUniqueOrThrow({ where: { id: chargeId } });

      if (fresh.status !== 'PENDING') {
        return null;
      }

      const paidAt = remote.paidAt ?? now;
      const amount = remote.paidAmount ?? fresh.amount.toFixed(2);
      const account = await this.receivingAccount(tx);
      const receipt =
        account === null
          ? {
              ok: false as const,
              reason: 'Nenhuma conta do Caixa configurada para o PIX automático.'
            }
          : fresh.purpose === 'ORDER' && fresh.orderId
            ? await this.orders.receivePixInTx(tx, fresh.orderId, {
                amount: money(amount),
                paidAt,
                accountId: account,
                provider: fresh.provider,
                reference: fresh.providerChargeId
              })
            : fresh.monthlyFeeId
              ? await this.fees.receivePixInTx(tx, fresh.monthlyFeeId, {
                  amount: money(amount),
                  paidAt,
                  accountId: account,
                  provider: fresh.provider,
                  reference: fresh.providerChargeId
                })
              : { ok: false as const, reason: 'Cobrança sem pedido ou mensalidade.' };

      await tx.pixCharge.update({
        where: { id: chargeId },
        data: receipt.ok
          ? { status: 'PAID', paidAt, paymentId: receipt.paymentId, lastCheckedAt: now }
          : { status: 'REVIEW', paidAt, reviewReason: receipt.reason, lastCheckedAt: now }
      });
      await this.audit.record(
        {
          actorUserId: null,
          action: receipt.ok ? 'pix.charge.paid' : 'pix.charge.review',
          entityType: 'PixCharge',
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
      // Dinheiro recebido fora do esperado: a diretoria decide (estornar ou aplicar).
      await this.staffAlerts.alert(PERMISSIONS.paymentsConfirm, {
        type: 'staff.pix.review',
        title: 'PIX recebido para revisar',
        message: review,
        link: '/admin/pix',
        key: `staff-pix-review:${chargeId}`
      });
    }

    return this.prisma.pixCharge.findUniqueOrThrow({ where: { id: chargeId } });
  }

  async syncPending(now: Date = new Date()): Promise<number> {
    const pending = await this.prisma.pixCharge.findMany({
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
          `Falha ao conferir cobrança PIX: ${error instanceof Error ? error.name : 'erro'}.`
        );
      }
    }

    return pending.length;
  }

  /** Conta do Caixa configurada; sem ela, a conta padrão "Conta bancária / PIX". */
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

  // ---------- Diretoria ----------

  async admin(): Promise<PixAdminView> {
    const [settings, review] = await Promise.all([
      this.prisma.teamSettings.findFirst({ select: { pixAccountId: true } }),
      this.prisma.pixCharge.findMany({
        where: { status: 'REVIEW' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          order: { select: { orderNumber: true } },
          monthlyFee: { select: { referenceMonth: true, athlete: { select: { fullName: true } } } }
        }
      })
    ]);

    return {
      provider: this.config.values.pix.provider,
      enabled: this.provider !== null,
      accountId: settings?.pixAccountId ?? null,
      review: review.map((row) => ({
        id: row.id,
        purpose: row.purpose,
        reference: row.order
          ? `Pedido ${row.order.orderNumber}`
          : row.monthlyFee
            ? `Mensalidade ${row.monthlyFee.referenceMonth.toISOString().slice(0, 7)} — ${row.monthlyFee.athlete.fullName}`
            : '—',
        amount: moneyView(row.amount, row.currency),
        paidAt: row.paidAt?.toISOString() ?? null,
        reason: row.reviewReason
      }))
    };
  }

  async setAccount(actor: Principal, accountId: string, meta: RequestMeta): Promise<PixAdminView> {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: accountId, deletedAt: null, isActive: true },
      select: { id: true, name: true }
    });

    if (account === null) {
      throw AppError.validation('INVALID_ACCOUNT', 'Escolha uma conta ativa do Caixa.');
    }

    const settings = await this.prisma.teamSettings.findFirstOrThrow({ select: { id: true } });

    await this.prisma.teamSettings.update({
      where: { id: settings.id },
      data: { pixAccountId: accountId }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'pix.account.set',
      entityType: 'TeamSettings',
      entityId: settings.id,
      after: { accountId, name: account.name },
      meta
    });

    return this.admin();
  }

  /** Revisão resolvida fora do sistema (ex.: estorno no painel do intermediário). */
  async resolveReview(
    actor: Principal,
    chargeId: string,
    reason: string,
    meta: RequestMeta
  ): Promise<PixAdminView> {
    const { count } = await this.prisma.pixCharge.updateMany({
      where: { id: chargeId, status: 'REVIEW' },
      data: { status: 'CANCELLED', reviewReason: reason }
    });

    if (count === 0) {
      throw AppError.notFound('Cobrança em revisão não encontrada.');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'pix.review.resolved',
      entityType: 'PixCharge',
      entityId: chargeId,
      reason,
      meta
    });

    return this.admin();
  }
}
