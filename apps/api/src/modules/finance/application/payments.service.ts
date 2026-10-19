import { Injectable } from '@nestjs/common';
import type { FinancialOrigin, PaymentStatus } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import {
  DEFAULT_CURRENCY,
  type Money,
  type MoneyView,
  moneyView
} from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { LedgerService, lockRow } from './ledger.service';

export interface PaymentView {
  readonly id: string;
  readonly amount: MoneyView;
  readonly status: PaymentStatus;
  readonly method: { id: string; name: string };
  readonly paidAt: string | null;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly transactionId: string | null;
  readonly attachments: { id: string; fileName: string }[];
}

export interface NewPayment {
  readonly paymentMethodId: string;
  readonly amount: Money;
  readonly payerUserId: string | null;
  readonly orderId?: string | null;
  readonly paidAt: Date | null;
  readonly notes?: string | null;
  readonly idempotencyKey: string;
}

/**
 * Pagamentos (RF-013, RF-029). Confirmar um pagamento cria exatamente uma entrada no
 * Caixa (`payment_id` único no lançamento). Estorno gera `Refund` e lançamento oposto
 * vinculado; nada é apagado (RN-MEN-007, RN-FIN-005).
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService
  ) {}

  async view(id: string): Promise<PaymentView> {
    const row = await this.prisma.payment.findUniqueOrThrow({
      where: { id },
      include: {
        paymentMethod: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        financialTransaction: { select: { id: true } },
        attachments: {
          where: { deletedAt: null },
          select: { id: true, mediaFile: { select: { originalName: true } } }
        }
      }
    });

    return {
      id: row.id,
      amount: moneyView(row.amount, row.currency),
      status: row.status,
      method: row.paymentMethod,
      paidAt: row.paidAt?.toISOString() ?? null,
      notes: row.notes,
      createdBy: row.createdBy?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      transactionId: row.financialTransaction?.id ?? null,
      attachments: row.attachments.map((a) => ({ id: a.id, fileName: a.mediaFile.originalName }))
    };
  }

  /** Cria pagamento pendente; reenvio com a mesma chave pelo mesmo autor devolve o existente. */
  async createInTx(
    tx: PrismaTx,
    actorId: string,
    input: NewPayment
  ): Promise<{ id: string; replayed: boolean }> {
    const existing = await tx.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, createdById: true }
    });

    if (existing) {
      if (existing.createdById !== actorId) {
        throw AppError.conflict('IDEMPOTENCY_CONFLICT', 'Chave de idempotência já utilizada.');
      }

      return { id: existing.id, replayed: true };
    }

    const method = await tx.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, deletedAt: null, isActive: true },
      select: { id: true }
    });

    if (method === null) {
      throw AppError.validation('INVALID_METHOD', 'Forma de pagamento inexistente ou inativa.');
    }

    const created = await tx.payment.create({
      data: {
        paymentMethodId: input.paymentMethodId,
        payerUserId: input.payerUserId,
        orderId: input.orderId ?? null,
        amount: input.amount,
        currency: DEFAULT_CURRENCY,
        status: 'PENDING',
        provider: 'manual',
        idempotencyKey: input.idempotencyKey,
        paidAt: input.paidAt,
        notes: input.notes?.trim() || null,
        createdById: actorId
      },
      select: { id: true }
    });

    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'payment.created',
        entityType: 'Payment',
        entityId: created.id,
        after: { amount: input.amount.toFixed(2), status: 'PENDING' }
      },
      tx
    );

    return { id: created.id, replayed: false };
  }

  /**
   * Confirma o pagamento e lança a entrada no Caixa na mesma transação (DT-013).
   * Idempotente: pagamento já confirmado não gera segundo lançamento.
   */
  async confirmInTx(
    tx: PrismaTx,
    actorId: string,
    paymentId: string,
    input: {
      accountId: string;
      categoryCode: string;
      origin: FinancialOrigin;
      description: string;
      paidAt?: Date;
    }
  ): Promise<{ alreadyConfirmed: boolean }> {
    await lockRow(tx, 'payment', paymentId);
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });

    if (payment === null) {
      throw AppError.notFound('Pagamento não encontrado.');
    }

    if (payment.status === 'CONFIRMED') {
      return { alreadyConfirmed: true };
    }

    if (payment.status !== 'PENDING') {
      throw AppError.conflict(
        'PAYMENT_NOT_PENDING',
        'Somente pagamentos pendentes podem ser confirmados.'
      );
    }

    const paidAt = input.paidAt ?? payment.paidAt ?? new Date();

    await tx.payment.update({ where: { id: paymentId }, data: { status: 'CONFIRMED', paidAt } });
    await this.ledger.post(tx, actorId, {
      accountId: input.accountId,
      categoryId: await this.ledger.categoryId(tx, input.categoryCode),
      paymentMethodId: payment.paymentMethodId,
      direction: 'INCOME',
      origin: input.origin,
      amount: payment.amount,
      occurredAt: paidAt,
      description: input.description,
      idempotencyKey: `payment:${paymentId}`,
      status: 'CONFIRMED',
      paymentId
    });
    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'payment.confirmed',
        entityType: 'Payment',
        entityId: paymentId,
        before: { status: 'PENDING' },
        after: { status: 'CONFIRMED' }
      },
      tx
    );

    return { alreadyConfirmed: false };
  }

  /** Pendente: cancela. Confirmado: reembolso/estorno vinculado e saída no Caixa. */
  async reverseInTx(
    tx: PrismaTx,
    actorId: string,
    paymentId: string,
    reason: string,
    idempotencyKey: string
  ): Promise<PaymentStatus> {
    await lockRow(tx, 'payment', paymentId);
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { financialTransaction: { select: { id: true } } }
    });

    if (payment === null) {
      throw AppError.notFound('Pagamento não encontrado.');
    }

    if (payment.status === 'PENDING') {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'CANCELLED', failureReason: reason }
      });
      await this.audit.record(
        {
          actorUserId: actorId,
          action: 'payment.cancelled',
          entityType: 'Payment',
          entityId: paymentId,
          reason,
          before: { status: 'PENDING' },
          after: { status: 'CANCELLED' }
        },
        tx
      );

      return 'CANCELLED';
    }

    if (payment.status !== 'CONFIRMED') {
      throw AppError.conflict('PAYMENT_NOT_REVERSIBLE', 'Este pagamento não pode ser estornado.');
    }

    const refund = await tx.refund.create({
      data: {
        paymentId,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        status: 'COMPLETED',
        reason,
        idempotencyKey: `refund:${idempotencyKey}`,
        requestedById: actorId,
        approvedById: actorId,
        approvedAt: new Date(),
        processedAt: new Date()
      }
    });

    if (payment.financialTransaction) {
      await this.ledger.reverseInTx(
        tx,
        actorId,
        payment.financialTransaction.id,
        reason,
        `refund-tx:${refund.id}`,
        new Date(),
        {
          origin: 'REFUND',
          refundId: refund.id,
          allowPaymentLinked: true
        }
      );
    }

    await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'payment.refunded',
        entityType: 'Payment',
        entityId: paymentId,
        reason,
        before: { status: 'CONFIRMED' },
        after: { status: 'REFUNDED', refundId: refund.id }
      },
      tx
    );

    return 'REFUNDED';
  }
}
