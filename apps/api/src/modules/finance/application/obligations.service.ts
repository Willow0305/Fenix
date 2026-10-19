import { Injectable } from '@nestjs/common';
import type { FinancialObligationStatus, FinancialObligationType, Prisma } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, dateToCivil, todayIn } from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  type MoneyView,
  moneyView,
  round2,
  ZERO
} from '../../../common/domain/money';
import { startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { effectiveObligationStatus } from '../domain/finance-rules';
import { LedgerService, lockRow } from './ledger.service';

export interface ObligationView {
  readonly id: string;
  readonly type: FinancialObligationType;
  readonly status: FinancialObligationStatus;
  readonly category: { id: string; name: string };
  readonly costCenter: { id: string; name: string } | null;
  readonly counterpartyName: string;
  readonly description: string;
  readonly competenceDate: string;
  readonly dueDate: string;
  readonly amount: MoneyView;
  readonly settledAt: string | null;
  readonly settlementTransactionId: string | null;
  readonly cancellationReason: string | null;
  readonly notes: string | null;
}

export interface ObligationFilters extends PageQueryDto {
  readonly type?: FinancialObligationType;
  readonly status?: FinancialObligationStatus;
  readonly from?: string;
  readonly to?: string;
}

const INCLUDE = {
  category: { select: { id: true, name: true } },
  costCenter: { select: { id: true, name: true } }
} satisfies Prisma.FinancialObligationInclude;

/** Contas a pagar e a receber (RCF-004): obrigação separada do movimento de caixa. */
@Injectable()
export class ObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService
  ) {}

  private toView(
    row: Prisma.FinancialObligationGetPayload<{ include: typeof INCLUDE }>,
    today: string
  ): ObligationView {
    return {
      id: row.id,
      type: row.type,
      status: effectiveObligationStatus(row.status, dateToCivil(row.dueDate), today),
      category: row.category,
      costCenter: row.costCenter,
      counterpartyName: row.counterpartyName,
      description: row.description,
      competenceDate: dateToCivil(row.competenceDate),
      dueDate: dateToCivil(row.dueDate),
      amount: moneyView(row.amount, row.currency),
      settledAt: row.settledAt?.toISOString() ?? null,
      settlementTransactionId: row.settlementTransactionId,
      cancellationReason: row.cancellationReason,
      notes: row.notes
    };
  }

  async list(
    filters: ObligationFilters
  ): Promise<Page<ObligationView> & { totals: { open: MoneyView } }> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const today = todayIn();
    const statusWhere: Prisma.FinancialObligationWhereInput =
      filters.status === 'OVERDUE'
        ? { status: 'OPEN', dueDate: { lt: civilToDate(today) } }
        : filters.status
          ? { status: filters.status }
          : {};
    const where: Prisma.FinancialObligationWhereInput = {
      ...statusWhere,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.search
        ? {
            OR: [
              { counterpartyName: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(filters.from || filters.to
        ? {
            dueDate: {
              ...(filters.from ? { gte: civilToDate(filters.from) } : {}),
              ...(filters.to ? { lte: civilToDate(filters.to) } : {})
            }
          }
        : {})
    };
    const [rows, total, open] = await this.prisma.$transaction([
      this.prisma.financialObligation.findMany({
        where,
        include: INCLUDE,
        orderBy: { dueDate: 'asc' },
        skip,
        take
      }),
      this.prisma.financialObligation.count({ where }),
      this.prisma.financialObligation.aggregate({
        where: { ...where, status: 'OPEN' },
        _sum: { amount: true }
      })
    ]);

    return {
      ...toPage(
        rows.map((row) => this.toView(row, today)),
        total,
        page,
        pageSize
      ),
      totals: { open: moneyView(open._sum.amount ?? ZERO) }
    };
  }

  async get(id: string): Promise<ObligationView> {
    const row = await this.prisma.financialObligation.findUnique({
      where: { id },
      include: INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Conta não encontrada.');
    }

    return this.toView(row, todayIn());
  }

  async create(
    actor: Principal,
    input: {
      type: FinancialObligationType;
      categoryId: string;
      costCenterId?: string;
      counterpartyName: string;
      description: string;
      competenceDate: string;
      dueDate: string;
      amount: Money;
      notes?: string;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<ObligationView> {
    const key = `obligation:${idempotencyKey}`;
    const existing = await this.prisma.financialObligation.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, createdById: true }
    });

    if (existing) {
      if (existing.createdById !== actor.userId) {
        throw AppError.conflict('IDEMPOTENCY_CONFLICT', 'Chave de idempotência já utilizada.');
      }

      return this.get(existing.id);
    }

    const category = await this.prisma.financialCategory.findFirst({
      where: { id: input.categoryId, isActive: true, deletedAt: null }
    });
    const expected = input.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';

    if (category === null || category.nature !== expected) {
      throw AppError.validation(
        'CATEGORY_NATURE',
        input.type === 'PAYABLE' ? 'Use uma categoria de despesa.' : 'Use uma categoria de receita.'
      );
    }

    const row = await this.prisma.financialObligation.create({
      data: {
        type: input.type,
        categoryId: input.categoryId,
        costCenterId: input.costCenterId ?? null,
        counterpartyName: input.counterpartyName.trim(),
        description: input.description.trim(),
        competenceDate: civilToDate(input.competenceDate),
        dueDate: civilToDate(input.dueDate),
        amount: round2(input.amount),
        currency: DEFAULT_CURRENCY,
        idempotencyKey: key,
        notes: input.notes?.trim() || null,
        createdById: actor.userId
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.obligation.created',
      entityType: 'FinancialObligation',
      entityId: row.id,
      after: { type: row.type, amount: input.amount.toFixed(2), dueDate: input.dueDate },
      meta
    });

    return this.get(row.id);
  }

  /** Quitação gera exatamente um lançamento confirmado vinculado (RCF-004). */
  async settle(
    actor: Principal,
    id: string,
    input: { accountId: string; paidOn: string; paymentMethodId?: string },
    meta: RequestMeta
  ): Promise<ObligationView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'obligation', id);
      const row = await tx.financialObligation.findUnique({ where: { id } });

      if (row === null) {
        throw AppError.notFound('Conta não encontrada.');
      }

      if (row.status !== 'OPEN' && row.status !== 'OVERDUE') {
        throw AppError.conflict('OBLIGATION_CLOSED', 'Esta conta não está em aberto.');
      }

      const transactionId = await this.ledger.post(tx, actor.userId, {
        accountId: input.accountId,
        categoryId: row.categoryId,
        costCenterId: row.costCenterId,
        paymentMethodId: input.paymentMethodId ?? null,
        direction: row.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME',
        origin: 'MANUAL',
        amount: row.amount,
        occurredAt: startOfDayInZone(input.paidOn),
        competenceDate: dateToCivil(row.competenceDate),
        dueDate: dateToCivil(row.dueDate),
        description: `${row.type === 'PAYABLE' ? 'Pagamento' : 'Recebimento'}: ${row.description} (${row.counterpartyName})`,
        idempotencyKey: `obligation-settlement:${id}`,
        status: 'CONFIRMED'
      });

      await tx.financialObligation.update({
        where: { id },
        data: { status: 'SETTLED', settledAt: new Date(), settlementTransactionId: transactionId }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.obligation.settled',
          entityType: 'FinancialObligation',
          entityId: id,
          after: { transactionId },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  async cancel(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<ObligationView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'obligation', id);
      const row = await tx.financialObligation.findUnique({ where: { id } });

      if (row === null) {
        throw AppError.notFound('Conta não encontrada.');
      }

      if (row.status === 'SETTLED') {
        throw AppError.conflict(
          'OBLIGATION_SETTLED',
          'Conta quitada não é cancelada: estorne o lançamento de quitação.'
        );
      }

      if (row.status === 'CANCELLED') {
        throw AppError.conflict('OBLIGATION_CANCELLED', 'Conta já cancelada.');
      }

      await tx.financialObligation.update({
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
          action: 'finance.obligation.cancelled',
          entityType: 'FinancialObligation',
          entityId: id,
          reason,
          meta
        },
        tx
      );
    });

    return this.get(id);
  }
}
