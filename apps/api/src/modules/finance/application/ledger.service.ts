import { Injectable } from '@nestjs/common';
import {
  type FinancialDirection,
  type FinancialOrigin,
  type FinancialTransactionStatus,
  Prisma
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, dateToCivil } from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  money,
  type MoneyView,
  moneyView,
  ZERO
} from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { civilDateOf, endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import {
  DOCUMENT_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { SYSTEM_CATEGORY } from '../domain/finance-catalog';
import {
  isInClosedPeriod,
  oppositeDirection,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TRANSITIONS
} from '../domain/finance-rules';

export interface PostInput {
  readonly accountId: string;
  readonly categoryId: string;
  readonly costCenterId?: string | null;
  readonly paymentMethodId?: string | null;
  readonly direction: FinancialDirection;
  readonly origin: FinancialOrigin;
  readonly amount: Money;
  readonly occurredAt: Date;
  readonly competenceDate?: string;
  readonly dueDate?: string | null;
  readonly description: string;
  readonly notes?: string | null;
  readonly idempotencyKey: string;
  readonly status: 'PENDING' | 'CONFIRMED';
  readonly paymentId?: string | null;
  readonly refundId?: string | null;
  readonly partnerSettlementId?: string | null;
  readonly reversesTransactionId?: string | null;
}

export interface TransactionView {
  readonly id: string;
  readonly direction: FinancialDirection;
  readonly origin: FinancialOrigin;
  readonly status: FinancialTransactionStatus;
  readonly amount: MoneyView;
  readonly account: { id: string; name: string };
  readonly category: { id: string; name: string };
  readonly costCenter: { id: string; name: string } | null;
  readonly paymentMethod: { id: string; name: string } | null;
  readonly occurredAt: string | null;
  readonly occurredOn: string | null;
  readonly competenceDate: string;
  readonly description: string;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly confirmedBy: string | null;
  readonly confirmedAt: string | null;
  readonly cancellationReason: string | null;
  readonly reversesTransactionId: string | null;
  readonly reversedBy: string | null;
  readonly paymentId: string | null;
  readonly attachments: { id: string; fileName: string; mediaFileId: string }[];
  readonly reconciledAt: string | null;
}

export interface TransactionFilters extends PageQueryDto {
  readonly accountId?: string;
  readonly categoryId?: string;
  readonly costCenterId?: string;
  readonly direction?: FinancialDirection;
  readonly status?: FinancialTransactionStatus;
  readonly origin?: FinancialOrigin;
  readonly from?: string;
  readonly to?: string;
  readonly withoutAttachment?: boolean;
}

export interface AccountBalance {
  readonly accountId: string;
  readonly accountName: string;
  readonly balance: MoneyView;
}

const VIEW_INCLUDE = {
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  costCenter: { select: { id: true, name: true } },
  paymentMethod: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  confirmedBy: { select: { name: true } },
  reversalTransactions: { where: { status: 'CONFIRMED' }, select: { id: true } },
  attachments: {
    where: { deletedAt: null },
    select: { id: true, mediaFileId: true, mediaFile: { select: { originalName: true } } }
  }
} satisfies Prisma.FinancialTransactionInclude;

type TransactionRow = Prisma.FinancialTransactionGetPayload<{ include: typeof VIEW_INCLUDE }>;

const LOCKABLE_TABLES = {
  monthlyFee: 'monthly_fees',
  transaction: 'financial_transactions',
  account: 'financial_accounts',
  payment: 'payments',
  order: 'orders',
  variant: 'product_variants',
  product: 'products',
  campaign: 'sales_campaigns',
  coupon: 'coupons',
  obligation: 'financial_obligations',
  partner: 'partners',
  settlement: 'partner_settlements',
  pixCharge: 'pix_charges',
  professional: 'partner_professionals',
  availability: 'professional_availabilities',
  appointment: 'appointments'
} as const;

/** `SELECT ... FOR UPDATE` para serializar alterações concorrentes na mesma linha (DT-013). */
export async function lockRow(
  tx: PrismaTx,
  table: keyof typeof LOCKABLE_TABLES,
  id: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM ${Prisma.raw(LOCKABLE_TABLES[table])} WHERE id = ${id}::uuid FOR UPDATE`;
}

/**
 * Livro-caixa (RN-FIN-001..011). Toda movimentação passa por `post`, que valida conta,
 * categoria, moeda, idempotência e período fechado. Confirmado nunca é editado nem
 * apagado: correções geram lançamentos vinculados.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService
  ) {}

  toView(row: TransactionRow): TransactionView {
    return {
      id: row.id,
      direction: row.direction,
      origin: row.origin,
      status: row.status,
      amount: moneyView(row.amount, row.currency),
      account: row.account,
      category: row.category,
      costCenter: row.costCenter,
      paymentMethod: row.paymentMethod,
      occurredAt: row.occurredAt?.toISOString() ?? null,
      occurredOn: row.occurredAt ? civilDateOf(row.occurredAt) : null,
      competenceDate: dateToCivil(row.competenceDate),
      description: row.description,
      notes: row.notes,
      createdBy: row.createdBy?.name ?? null,
      confirmedBy: row.confirmedBy?.name ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      cancellationReason: row.cancellationReason,
      reversesTransactionId: row.reversesTransactionId,
      reversedBy: row.reversalTransactions[0]?.id ?? null,
      paymentId: row.paymentId,
      attachments: row.attachments.map((a) => ({
        id: a.id,
        fileName: a.mediaFile.originalName,
        mediaFileId: a.mediaFileId
      })),
      reconciledAt: row.reconciledAt?.toISOString() ?? null
    };
  }

  async categoryId(tx: PrismaTx, code: string): Promise<string> {
    const category = await tx.financialCategory.findUnique({
      where: { code },
      select: { id: true }
    });

    if (category === null) {
      throw new Error(`Categoria de sistema ausente (${code}): execute npm run db:seed.`);
    }

    return category.id;
  }

  /** RF-030: bloqueia movimentos datados em período fechado da conta. */
  async assertOpenPeriod(tx: PrismaTx, accountId: string, occurredAt: Date): Promise<void> {
    const date = civilDateOf(occurredAt);
    const closed = await tx.cashClosing.findMany({
      where: {
        financialAccountId: accountId,
        status: 'CLOSED',
        periodStart: { lte: civilToDate(date) },
        periodEnd: { gte: civilToDate(date) }
      },
      select: { periodStart: true, periodEnd: true }
    });

    if (
      isInClosedPeriod(
        date,
        closed.map((c) => ({
          periodStart: dateToCivil(c.periodStart),
          periodEnd: dateToCivil(c.periodEnd)
        }))
      )
    ) {
      throw AppError.conflict(
        'PERIOD_CLOSED',
        `O caixa desta conta está fechado para ${date.split('-').reverse().join('/')}. Reabra o fechamento ou use outra data.`
      );
    }
  }

  /** Retorna o id existente quando a mesma chave é reenviada pelo mesmo autor (replay). */
  private async replay(tx: PrismaTx, key: string, actorId: string | null): Promise<string | null> {
    const existing = await tx.financialTransaction.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, createdById: true }
    });

    if (existing === null) {
      return null;
    }

    if (existing.createdById !== actorId) {
      throw AppError.conflict('IDEMPOTENCY_CONFLICT', 'Chave de idempotência já utilizada.');
    }

    return existing.id;
  }

  async post(tx: PrismaTx, actorId: string | null, input: PostInput): Promise<string> {
    const replayed = await this.replay(tx, input.idempotencyKey, actorId);

    if (replayed !== null) {
      return replayed;
    }

    if (input.amount.lessThanOrEqualTo(0)) {
      throw AppError.validation('INVALID_AMOUNT', 'O valor deve ser maior que zero.');
    }

    const account = await tx.financialAccount.findFirst({
      where: { id: input.accountId, deletedAt: null },
      select: { isActive: true, currency: true }
    });

    if (account === null || !account.isActive) {
      throw AppError.validation('INVALID_ACCOUNT', 'Conta financeira inexistente ou inativa.');
    }

    const category = await tx.financialCategory.findFirst({
      where: { id: input.categoryId, deletedAt: null },
      select: { isActive: true, nature: true }
    });

    if (category === null || !category.isActive) {
      throw AppError.validation('INVALID_CATEGORY', 'Categoria inexistente ou inativa.');
    }

    const isTransfer = input.origin === 'TRANSFER';

    if (isTransfer !== (category.nature === 'TRANSFER')) {
      throw AppError.validation(
        'CATEGORY_NATURE',
        'Categoria incompatível com o tipo de lançamento.'
      );
    }

    if (!isTransfer && input.reversesTransactionId == null && category.nature !== input.direction) {
      throw AppError.validation(
        'CATEGORY_NATURE',
        input.direction === 'INCOME'
          ? 'Use uma categoria de receita.'
          : 'Use uma categoria de despesa.'
      );
    }

    if (input.costCenterId) {
      const center = await tx.costCenter.findFirst({
        where: { id: input.costCenterId, deletedAt: null, isActive: true }
      });

      if (center === null) {
        throw AppError.validation('INVALID_COST_CENTER', 'Centro de custo inexistente ou inativo.');
      }
    }

    if (input.status === 'CONFIRMED') {
      await this.assertOpenPeriod(tx, input.accountId, input.occurredAt);
    }

    const now = new Date();
    const created = await tx.financialTransaction.create({
      data: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        costCenterId: input.costCenterId ?? null,
        paymentMethodId: input.paymentMethodId ?? null,
        paymentId: input.paymentId ?? null,
        refundId: input.refundId ?? null,
        partnerSettlementId: input.partnerSettlementId ?? null,
        reversesTransactionId: input.reversesTransactionId ?? null,
        direction: input.direction,
        origin: input.origin,
        status: input.status,
        amount: input.amount,
        currency: account.currency,
        competenceDate: civilToDate(input.competenceDate ?? civilDateOf(input.occurredAt)),
        dueDate: input.dueDate ? civilToDate(input.dueDate) : null,
        occurredAt: input.occurredAt,
        description: input.description.trim(),
        notes: input.notes?.trim() || null,
        idempotencyKey: input.idempotencyKey,
        createdById: actorId,
        ...(input.status === 'CONFIRMED' ? { confirmedAt: now, confirmedById: actorId } : {})
      },
      select: { id: true }
    });

    await this.audit.record(
      {
        actorUserId: actorId,
        action:
          input.status === 'CONFIRMED'
            ? 'finance.transaction.posted'
            : 'finance.transaction.created',
        entityType: 'FinancialTransaction',
        entityId: created.id,
        after: {
          direction: input.direction,
          origin: input.origin,
          amount: input.amount.toFixed(2),
          accountId: input.accountId,
          status: input.status
        }
      },
      tx
    );

    return created.id;
  }

  async get(id: string): Promise<TransactionView> {
    const row = await this.prisma.financialTransaction.findUnique({
      where: { id },
      include: VIEW_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Lançamento não encontrado.');
    }

    return this.toView(row);
  }

  async list(filters: TransactionFilters): Promise<Page<TransactionView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const search = filters.search?.trim();
    const where: Prisma.FinancialTransactionWhereInput = {
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.origin ? { origin: filters.origin } : {}),
      ...(filters.withoutAttachment
        ? { attachments: { none: { deletedAt: null } }, paymentId: null }
        : {}),
      ...(search ? { description: { contains: search, mode: 'insensitive' } } : {}),
      ...(filters.from || filters.to
        ? {
            occurredAt: {
              ...(filters.from ? { gte: startOfDayInZone(filters.from) } : {}),
              ...(filters.to ? { lt: endOfDayExclusive(filters.to) } : {})
            }
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.financialTransaction.findMany({
        where,
        include: VIEW_INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take
      }),
      this.prisma.financialTransaction.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize
    );
  }

  async createManual(
    actor: Principal,
    input: {
      accountId: string;
      categoryId: string;
      costCenterId?: string;
      paymentMethodId?: string;
      direction: FinancialDirection;
      amount: Money;
      occurredOn: string;
      competenceDate?: string;
      description: string;
      notes?: string;
      confirmNow?: boolean;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<TransactionView> {
    if (input.confirmNow && !actor.permissions.has(PERMISSIONS.transactionsConfirm)) {
      throw AppError.forbidden('Você não tem permissão para confirmar lançamentos.');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      const txId = await this.post(tx, actor.userId, {
        accountId: input.accountId,
        categoryId: input.categoryId,
        costCenterId: input.costCenterId ?? null,
        paymentMethodId: input.paymentMethodId ?? null,
        direction: input.direction,
        origin: 'MANUAL',
        amount: input.amount,
        occurredAt: startOfDayInZone(input.occurredOn),
        ...(input.competenceDate
          ? { competenceDate: input.competenceDate }
          : { competenceDate: input.occurredOn }),
        description: input.description,
        notes: input.notes ?? null,
        idempotencyKey: `manual:${idempotencyKey}`,
        status: input.confirmNow ? 'CONFIRMED' : 'PENDING'
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.transaction.manual',
          entityType: 'FinancialTransaction',
          entityId: txId,
          meta
        },
        tx
      );

      return txId;
    });

    return this.get(id);
  }

  async confirm(actor: Principal, id: string, meta: RequestMeta): Promise<TransactionView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'transaction', id);
      const current = await tx.financialTransaction.findUnique({ where: { id } });

      if (current === null) {
        throw AppError.notFound('Lançamento não encontrado.');
      }

      if (current.paymentId) {
        throw AppError.conflict(
          'USE_PAYMENT_FLOW',
          'Lançamentos de pagamento são confirmados pelo pagamento de origem.'
        );
      }

      assertTransition(
        TRANSACTION_TRANSITIONS,
        current.status,
        'CONFIRMED',
        TRANSACTION_STATUS_LABELS
      );
      await this.assertOpenPeriod(tx, current.accountId, current.occurredAt ?? new Date());
      await tx.financialTransaction.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: actor.userId }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.transaction.confirmed',
          entityType: 'FinancialTransaction',
          entityId: id,
          before: { status: current.status },
          after: { status: 'CONFIRMED' },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  /** Cancela lançamento ainda não confirmado (pendente/rascunho). */
  async cancel(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<TransactionView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'transaction', id);
      const current = await tx.financialTransaction.findUnique({ where: { id } });

      if (current === null) {
        throw AppError.notFound('Lançamento não encontrado.');
      }

      if (current.status === 'CONFIRMED') {
        throw AppError.conflict(
          'CONFIRMED_IMMUTABLE',
          'Lançamento confirmado não é cancelado: use o estorno.'
        );
      }

      assertTransition(
        TRANSACTION_TRANSITIONS,
        current.status,
        'CANCELLED',
        TRANSACTION_STATUS_LABELS
      );
      await tx.financialTransaction.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: actor.userId,
          cancellationReason: reason
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.transaction.cancelled',
          entityType: 'FinancialTransaction',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status: 'CANCELLED' },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  /**
   * Estorno (RN-FIN-005/006): cria lançamento oposto, confirmado e vinculado. O original
   * permanece intacto. Datado na data informada (padrão: hoje), que precisa estar aberta.
   */
  async reverseInTx(
    tx: PrismaTx,
    actorId: string | null,
    id: string,
    reason: string,
    idempotencyKey: string,
    occurredAt: Date = new Date(),
    extra: { origin?: FinancialOrigin; refundId?: string | null; allowPaymentLinked?: boolean } = {}
  ): Promise<string> {
    await lockRow(tx, 'transaction', id);
    const original = await tx.financialTransaction.findUnique({
      where: { id },
      include: { reversalTransactions: { where: { status: 'CONFIRMED' }, select: { id: true } } }
    });

    if (original === null) {
      throw AppError.notFound('Lançamento não encontrado.');
    }

    if (original.status !== 'CONFIRMED') {
      throw AppError.conflict(
        'NOT_CONFIRMED',
        'Somente lançamentos confirmados podem ser estornados.'
      );
    }

    if (original.reversesTransactionId) {
      throw AppError.conflict(
        'IS_REVERSAL',
        'Um estorno não pode ser estornado; registre novo lançamento.'
      );
    }

    if (original.reversalTransactions.length > 0) {
      throw AppError.conflict('ALREADY_REVERSED', 'Este lançamento já foi estornado.');
    }

    if (original.origin === 'TRANSFER') {
      throw AppError.conflict(
        'USE_TRANSFER_FLOW',
        'Transferências são estornadas pela própria transferência.'
      );
    }

    if (original.paymentId && !extra.allowPaymentLinked) {
      throw AppError.conflict(
        'USE_PAYMENT_FLOW',
        'Lançamentos de pagamento são estornados pelo pagamento de origem.'
      );
    }

    const reversalId = await this.post(tx, actorId, {
      accountId: original.accountId,
      categoryId: original.categoryId,
      costCenterId: original.costCenterId,
      paymentMethodId: original.paymentMethodId,
      direction: oppositeDirection(original.direction),
      origin: extra.origin ?? 'ADJUSTMENT',
      amount: original.amount,
      occurredAt,
      description: `Estorno: ${original.description}`,
      notes: reason,
      idempotencyKey,
      status: 'CONFIRMED',
      reversesTransactionId: original.id,
      refundId: extra.refundId ?? null
    });

    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'finance.transaction.reversed',
        entityType: 'FinancialTransaction',
        entityId: id,
        reason,
        after: { reversalId },
        metadata: { amount: original.amount.toFixed(2) }
      },
      tx
    );

    return reversalId;
  }

  async reverse(
    actor: Principal,
    id: string,
    reason: string,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<TransactionView> {
    const reversalId = await this.prisma.$transaction(async (tx) => {
      const created = await this.reverseInTx(
        tx,
        actor.userId,
        id,
        reason,
        `reversal:${idempotencyKey}`
      );

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.transaction.reversal_requested',
          entityType: 'FinancialTransaction',
          entityId: id,
          reason,
          meta
        },
        tx
      );

      return created;
    });

    return this.get(reversalId);
  }

  /** RCF-003: duas pernas vinculadas de mesmo valor, sem afetar o saldo agregado. */
  async transfer(
    actor: Principal,
    input: {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: Money;
      occurredOn: string;
      description?: string;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<{ id: string; debit: TransactionView; credit: TransactionView }> {
    if (input.sourceAccountId === input.destinationAccountId) {
      throw AppError.validation('SAME_ACCOUNT', 'Escolha contas diferentes para a transferência.');
    }

    const key = `transfer:${idempotencyKey}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.financialTransfer.findUnique({ where: { idempotencyKey: key } });

      if (existing) {
        if (existing.createdById !== actor.userId) {
          throw AppError.conflict('IDEMPOTENCY_CONFLICT', 'Chave de idempotência já utilizada.');
        }

        return existing;
      }

      const categoryId = await this.categoryId(tx, SYSTEM_CATEGORY.transfers);
      const occurredAt = startOfDayInZone(input.occurredOn);
      const description = input.description?.trim() || 'Transferência entre contas';
      const debitId = await this.post(tx, actor.userId, {
        accountId: input.sourceAccountId,
        categoryId,
        direction: 'EXPENSE',
        origin: 'TRANSFER',
        amount: input.amount,
        occurredAt,
        description,
        idempotencyKey: `${key}:debit`,
        status: 'CONFIRMED'
      });
      const creditId = await this.post(tx, actor.userId, {
        accountId: input.destinationAccountId,
        categoryId,
        direction: 'INCOME',
        origin: 'TRANSFER',
        amount: input.amount,
        occurredAt,
        description,
        idempotencyKey: `${key}:credit`,
        status: 'CONFIRMED'
      });
      const transfer = await tx.financialTransfer.create({
        data: {
          sourceAccountId: input.sourceAccountId,
          destinationAccountId: input.destinationAccountId,
          debitTransactionId: debitId,
          creditTransactionId: creditId,
          amount: input.amount,
          currency: DEFAULT_CURRENCY,
          transferredAt: occurredAt,
          idempotencyKey: key,
          description,
          createdById: actor.userId
        }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.transfer.created',
          entityType: 'FinancialTransfer',
          entityId: transfer.id,
          after: {
            amount: input.amount.toFixed(2),
            from: input.sourceAccountId,
            to: input.destinationAccountId
          },
          meta
        },
        tx
      );

      return transfer;
    });

    return {
      id: result.id,
      debit: await this.get(result.debitTransactionId),
      credit: await this.get(result.creditTransactionId)
    };
  }

  /** Saldo inicial controlado (PEN-022): uma vez por conta, como evento auditado. */
  async openingBalance(
    actor: Principal,
    accountId: string,
    input: { amount: Money; occurredOn: string; notes: string },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<TransactionView> {
    const id = await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'account', accountId);
      const existing = await tx.financialTransaction.count({
        where: { accountId, origin: 'OPENING_BALANCE', status: { not: 'CANCELLED' } }
      });

      if (existing > 0) {
        throw AppError.conflict(
          'OPENING_EXISTS',
          'Esta conta já possui saldo inicial. Use estorno e lançamento de ajuste.'
        );
      }

      const txId = await this.post(tx, actor.userId, {
        accountId,
        categoryId: await this.categoryId(tx, SYSTEM_CATEGORY.openingBalance),
        direction: 'INCOME',
        origin: 'OPENING_BALANCE',
        amount: input.amount,
        occurredAt: startOfDayInZone(input.occurredOn),
        description: 'Saldo inicial',
        notes: input.notes,
        idempotencyKey: `opening:${idempotencyKey}`,
        status: 'CONFIRMED'
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.opening_balance',
          entityType: 'FinancialAccount',
          entityId: accountId,
          reason: input.notes,
          after: { amount: input.amount.toFixed(2) },
          meta
        },
        tx
      );

      return txId;
    });

    return this.get(id);
  }

  /** RN-FIN-002: saldos derivados de lançamentos confirmados até o instante informado. */
  async balances(asOf?: Date): Promise<AccountBalance[]> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
    const grouped = await this.prisma.financialTransaction.groupBy({
      by: ['accountId', 'direction'],
      where: { status: 'CONFIRMED', ...(asOf ? { occurredAt: { lt: asOf } } : {}) },
      _sum: { amount: true }
    });

    return accounts.map((account) => {
      const income =
        grouped.find((g) => g.accountId === account.id && g.direction === 'INCOME')?._sum.amount ??
        ZERO;
      const expense =
        grouped.find((g) => g.accountId === account.id && g.direction === 'EXPENSE')?._sum.amount ??
        ZERO;

      return {
        accountId: account.id,
        accountName: account.name,
        balance: moneyView(money(income).minus(expense), account.currency)
      };
    });
  }

  async accountBalance(tx: PrismaTx, accountId: string, before: Date): Promise<Money> {
    const grouped = await tx.financialTransaction.groupBy({
      by: ['direction'],
      where: { accountId, status: 'CONFIRMED', occurredAt: { lt: before } },
      _sum: { amount: true }
    });
    const income = grouped.find((g) => g.direction === 'INCOME')?._sum.amount ?? ZERO;
    const expense = grouped.find((g) => g.direction === 'EXPENSE')?._sum.amount ?? ZERO;

    return money(income).minus(expense);
  }

  /** RF-028: comprovante fora do banco, classificado como confidencial. */
  async attach(
    actor: Principal,
    id: string,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<TransactionView> {
    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.financialTransaction.findUnique({
        where: { id },
        select: { id: true }
      });

      if (exists === null) {
        throw AppError.notFound('Lançamento não encontrado.');
      }

      const stored = await this.media.store(
        file,
        { ...DOCUMENT_POLICY, kind: 'RECEIPT', classification: 'CONFIDENTIAL' },
        actor.userId,
        tx
      );

      await tx.financialTransactionAttachment.create({
        data: { financialTransactionId: id, mediaFileId: stored.id, type: 'RECEIPT' }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.attachment.added',
          entityType: 'FinancialTransaction',
          entityId: id,
          after: { mediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  async attachmentFile(transactionId: string, attachmentId: string, principal: Principal) {
    const attachment = await this.prisma.financialTransactionAttachment.findFirst({
      where: { id: attachmentId, financialTransactionId: transactionId, deletedAt: null },
      select: { mediaFileId: true }
    });

    if (attachment === null) {
      throw AppError.notFound('Comprovante não encontrado.');
    }

    return this.media.read(attachment.mediaFileId, principal, true);
  }

  async markReconciled(
    actor: Principal,
    id: string,
    statementReference: string | null,
    meta: RequestMeta
  ): Promise<TransactionView> {
    const current = await this.prisma.financialTransaction.findUnique({
      where: { id },
      select: { status: true }
    });

    if (current === null) {
      throw AppError.notFound('Lançamento não encontrado.');
    }

    if (current.status !== 'CONFIRMED') {
      throw AppError.conflict(
        'NOT_CONFIRMED',
        'Somente lançamentos confirmados podem ser conciliados.'
      );
    }

    await this.prisma.financialTransaction.update({
      where: { id },
      data: { reconciledAt: new Date(), reconciledById: actor.userId, statementReference }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.transaction.reconciled',
      entityType: 'FinancialTransaction',
      entityId: id,
      after: { statementReference },
      meta
    });

    return this.get(id);
  }
}
