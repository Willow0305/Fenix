import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { dateToCivil } from '../../../common/domain/civil-date';
import { formatBrl, type Money } from '../../../common/domain/money';
import { startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import {
  DOCUMENT_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SYSTEM_CATEGORY } from '../domain/finance-catalog';
import { remainingAmount } from '../domain/finance-rules';
import { lockRow } from './ledger.service';
import { PaymentsService } from './payments.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { FeeDetail, FeeRow, paidOf } from './fee-view';
import { FeeReader } from './fee-view';

/**
 * Pagamento de mensalidades (RF-013, DT-027, DT-071): PIX automático, pagamento registrado
 * pela diretoria (parcial permitido, excedente recusado), comprovante do atleta, confirmação e
 * estorno vinculado.
 */
@Injectable()
export class FeePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly reader: FeeReader
  ) {}

  private assertCapacity(row: FeeRow, amount: Money): void {
    const { confirmed, pending } = paidOf(row);
    const available = remainingAmount(row.totalAmount, confirmed.plus(pending));

    if (amount.greaterThan(available)) {
      throw AppError.validation(
        'AMOUNT_EXCEEDS_BALANCE',
        `O valor excede o saldo em aberto desta mensalidade (${formatBrl(available)}).`
      );
    }
  }

  /**
   * Baixa automática do PIX da mensalidade (DT-071), sem pessoa da diretoria. Não baixa
   * mensalidade cancelada nem valor acima do saldo: devolve o motivo para revisão.
   */
  async receivePixInTx(
    tx: PrismaTx,
    feeId: string,
    input: { amount: Money; paidAt: Date; accountId: string; provider: string; reference: string }
  ): Promise<{ ok: true; paymentId: string } | { ok: false; reason: string }> {
    await lockRow(tx, 'monthlyFee', feeId);
    const row = await this.reader.loadRow(tx, feeId);

    if (row.status === 'CANCELLED') {
      return { ok: false, reason: 'Mensalidade cancelada depois de gerar o PIX.' };
    }

    try {
      this.assertCapacity(row, input.amount);
    } catch {
      return { ok: false, reason: 'Valor pago maior que o saldo em aberto da mensalidade.' };
    }

    const method = await tx.paymentMethod.findUniqueOrThrow({
      where: { code: 'pix' },
      select: { id: true }
    });
    const payment = await this.payments.createInTx(tx, null, {
      paymentMethodId: method.id,
      amount: input.amount,
      payerUserId: row.athlete.userId,
      paidAt: input.paidAt,
      notes: 'PIX automático',
      idempotencyKey: `pix:${input.provider}:${input.reference}`,
      provider: input.provider,
      externalReference: input.reference
    });

    if (!payment.replayed) {
      await tx.monthlyFeePayment.create({
        data: {
          monthlyFeeId: feeId,
          paymentId: payment.id,
          allocatedAmount: input.amount,
          currency: row.currency,
          createdById: null
        }
      });
      await this.confirmAllocated(tx, null, row, payment.id, input.accountId);
    }

    return { ok: true, paymentId: payment.id };
  }

  /** Saldo em aberto que ainda pode ser cobrado (sem contar pagamentos pendentes). */
  async outstandingInTx(tx: PrismaTx, feeId: string): Promise<Money> {
    const row = await this.reader.loadRow(tx, feeId);
    const { confirmed, pending } = paidOf(row);

    return remainingAmount(row.totalAmount, confirmed.plus(pending));
  }

  /**
   * RF-013: registra pagamento manual. Com `accountId` e permissão de confirmação,
   * confirma e lança no Caixa na mesma transação; caso contrário fica pendente.
   */
  async recordPayment(
    actor: Principal,
    feeId: string,
    input: {
      amount: Money;
      paymentMethodId: string;
      paidOn: string;
      notes?: string;
      accountId?: string;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    const confirmNow = input.accountId !== undefined;

    if (confirmNow && !actor.permissions.has(PERMISSIONS.paymentsConfirm)) {
      throw AppError.forbidden('Você não tem permissão para confirmar pagamentos.');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.reader.loadRow(tx, feeId);

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('FEE_CANCELLED', 'Mensalidade cancelada não recebe pagamentos.');
      }

      const payment = await this.payments.createInTx(tx, actor.userId, {
        paymentMethodId: input.paymentMethodId,
        amount: input.amount,
        payerUserId: row.athlete.userId,
        paidAt: startOfDayInZone(input.paidOn),
        notes: input.notes ?? null,
        idempotencyKey: `fee-payment:${idempotencyKey}`
      });

      if (payment.replayed) {
        return;
      }

      this.assertCapacity(row, input.amount);
      await tx.monthlyFeePayment.create({
        data: {
          monthlyFeeId: feeId,
          paymentId: payment.id,
          allocatedAmount: input.amount,
          currency: row.currency,
          createdById: actor.userId
        }
      });

      if (confirmNow) {
        await this.confirmAllocated(tx, actor.userId, row, payment.id, input.accountId as string);
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.payment.recorded',
          entityType: 'MonthlyFee',
          entityId: feeId,
          after: { paymentId: payment.id, amount: input.amount.toFixed(2), confirmed: confirmNow },
          meta
        },
        tx
      );
    });

    return this.reader.get(feeId);
  }

  private async confirmAllocated(
    tx: PrismaTx,
    actorId: string | null,
    row: FeeRow,
    paymentId: string,
    accountId: string
  ): Promise<void> {
    const month = dateToCivil(row.referenceMonth);

    await this.payments.confirmInTx(tx, actorId, paymentId, {
      accountId,
      categoryCode: SYSTEM_CATEGORY.monthlyFees,
      origin: 'MONTHLY_FEE',
      description: `Mensalidade ${month.slice(5, 7)}/${month.slice(0, 4)} — ${row.athlete.fullName}`
    });

    const { after } = await this.reader.refreshStatus(tx, row.id);

    if (row.athlete.userId) {
      await this.notifications.notify(
        {
          userId: row.athlete.userId,
          type: 'fee.payment.confirmed',
          title: after === 'PAID' ? 'Mensalidade quitada' : 'Pagamento confirmado',
          message:
            after === 'PAID'
              ? `Sua mensalidade de ${month.slice(5, 7)}/${month.slice(0, 4)} está quitada. Obrigado!`
              : `Recebemos um pagamento parcial da mensalidade de ${month.slice(5, 7)}/${month.slice(0, 4)}.`,
          link: '/minha-conta/mensalidades',
          deduplicationKey: `fee-payment-confirmed:${paymentId}`
        },
        tx
      );
    }
  }

  /** Confirma pagamento pendente (ex.: comprovante PIX enviado pelo atleta). */
  async confirmPayment(
    actor: Principal,
    feeId: string,
    paymentId: string,
    accountId: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.reader.loadRow(tx, feeId);

      if (!row.paymentAllocations.some((a) => a.payment.id === paymentId)) {
        throw AppError.notFound('Pagamento não pertence a esta mensalidade.');
      }

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('FEE_CANCELLED', 'Mensalidade cancelada não recebe pagamentos.');
      }

      await this.confirmAllocated(tx, actor.userId, row, paymentId, accountId);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.payment.confirmed',
          entityType: 'MonthlyFee',
          entityId: feeId,
          after: { paymentId },
          meta
        },
        tx
      );
    });

    return this.reader.get(feeId);
  }

  /** RN-MEN-007: pendente é cancelado; confirmado gera estorno vinculado. */
  async reversePayment(
    actor: Principal,
    feeId: string,
    paymentId: string,
    reason: string,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.reader.loadRow(tx, feeId);

      if (!row.paymentAllocations.some((a) => a.payment.id === paymentId)) {
        throw AppError.notFound('Pagamento não pertence a esta mensalidade.');
      }

      const status = await this.payments.reverseInTx(
        tx,
        actor.userId,
        paymentId,
        reason,
        idempotencyKey
      );
      const refreshed = await this.reader.refreshStatus(tx, feeId);

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'fee.payment.reversed',
          entityType: 'MonthlyFee',
          entityId: feeId,
          reason,
          before: { status: refreshed.before },
          after: { status: refreshed.after, paymentStatus: status, paymentId },
          meta
        },
        tx
      );
    });

    return this.reader.get(feeId);
  }

  /** Atleta envia comprovante PIX; fica pendente até a diretoria confirmar. */
  async submitProof(
    principal: Principal,
    feeId: string,
    input: { amount: Money; paidOn: string; notes?: string },
    file: IncomingFile | undefined,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<FeeDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'monthlyFee', feeId);
      const row = await this.reader.loadRow(tx, feeId);

      if (row.athlete.userId !== principal.userId) {
        throw AppError.notFound('Mensalidade não encontrada.');
      }

      if (row.status === 'CANCELLED' || row.status === 'PAID') {
        throw AppError.conflict('FEE_CLOSED', 'Esta mensalidade não está em aberto.');
      }

      const pix = await tx.paymentMethod.findUnique({
        where: { code: 'pix' },
        select: { id: true }
      });

      if (pix === null) {
        throw new Error('Forma de pagamento PIX ausente: execute npm run db:seed.');
      }

      const payment = await this.payments.createInTx(tx, principal.userId, {
        paymentMethodId: pix.id,
        amount: input.amount,
        payerUserId: principal.userId,
        paidAt: startOfDayInZone(input.paidOn),
        notes: input.notes ?? null,
        idempotencyKey: `fee-proof:${idempotencyKey}`
      });

      if (payment.replayed) {
        return;
      }

      this.assertCapacity(row, input.amount);
      const stored = await this.media.store(
        file,
        { ...DOCUMENT_POLICY, kind: 'RECEIPT', classification: 'CONFIDENTIAL' },
        principal.userId,
        tx
      );

      await tx.financialTransactionAttachment.create({
        data: { paymentId: payment.id, mediaFileId: stored.id, type: 'RECEIPT' }
      });
      await tx.monthlyFeePayment.create({
        data: {
          monthlyFeeId: feeId,
          paymentId: payment.id,
          allocatedAmount: input.amount,
          currency: row.currency,
          createdById: principal.userId
        }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'fee.proof.submitted',
          entityType: 'MonthlyFee',
          entityId: feeId,
          after: { paymentId: payment.id, amount: input.amount.toFixed(2) },
          meta
        },
        tx
      );
    });

    const detail = await this.reader.get(feeId, principal.userId);

    await this.staffAlerts.alert(PERMISSIONS.feesRead, {
      type: 'staff.fee.proof',
      title: 'Comprovante de mensalidade',
      message: `${detail.athlete.fullName} enviou o comprovante da mensalidade de ${detail.referenceMonth.slice(5, 7)}/${detail.referenceMonth.slice(0, 4)}.`,
      link: `/admin/mensalidades/${feeId}`,
      key: `staff-fee-proof:${feeId}:${idempotencyKey}`
    });

    return detail;
  }

  /** Comprovante de pagamento: dono do pagamento ou quem tem `fees.read`. */
  async paymentAttachment(principal: Principal, paymentId: string, attachmentId: string) {
    const attachment = await this.prisma.financialTransactionAttachment.findFirst({
      where: { id: attachmentId, paymentId, deletedAt: null },
      select: { mediaFileId: true, payment: { select: { payerUserId: true } } }
    });

    if (attachment === null) {
      throw AppError.notFound('Comprovante não encontrado.');
    }

    const allowed =
      principal.permissions.has(PERMISSIONS.feesRead) ||
      attachment.payment?.payerUserId === principal.userId;

    if (!allowed) {
      throw AppError.notFound('Comprovante não encontrado.');
    }

    return this.media.read(attachment.mediaFileId, principal, true);
  }
}
