import { Injectable } from '@nestjs/common';
import type { CashClosingStatus } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, dateToCivil } from '../../../common/domain/civil-date';
import { type Money, type MoneyView, moneyView, round2 } from '../../../common/domain/money';
import { endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { periodsIntersect } from '../domain/finance-rules';
import { LedgerService, lockRow } from './ledger.service';

export interface ClosingView {
  readonly id: string;
  readonly account: { id: string; name: string };
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly expectedBalance: MoneyView;
  readonly countedBalance: MoneyView;
  readonly differenceAmount: MoneyView;
  readonly status: CashClosingStatus;
  readonly notes: string | null;
  readonly closedBy: string | null;
  readonly closedAt: string | null;
  readonly reopenedBy: string | null;
  readonly reopenedAt: string | null;
  readonly reopeningReason: string | null;
}

export interface ClosingPreview {
  readonly accountId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly openingBalance: MoneyView;
  readonly income: MoneyView;
  readonly expense: MoneyView;
  readonly expectedBalance: MoneyView;
  readonly pendingTransactions: number;
}

/** Conferência e fechamento de caixa por conta e período (RF-030, RCF-006). */
@Injectable()
export class ClosingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService
  ) {}

  async list(accountId?: string): Promise<ClosingView[]> {
    const rows = await this.prisma.cashClosing.findMany({
      where: accountId ? { financialAccountId: accountId } : {},
      orderBy: [{ periodEnd: 'desc' }],
      include: {
        financialAccount: { select: { id: true, name: true } },
        closedBy: { select: { name: true } },
        reopenedBy: { select: { name: true } }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      account: row.financialAccount,
      periodStart: dateToCivil(row.periodStart),
      periodEnd: dateToCivil(row.periodEnd),
      expectedBalance: moneyView(row.expectedBalance, row.currency),
      countedBalance: moneyView(row.countedBalance, row.currency),
      differenceAmount: moneyView(row.differenceAmount, row.currency),
      status: row.status,
      notes: row.notes,
      closedBy: row.closedBy?.name ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      reopenedBy: row.reopenedBy?.name ?? null,
      reopenedAt: row.reopenedAt?.toISOString() ?? null,
      reopeningReason: row.reopeningReason
    }));
  }

  private assertPeriod(periodStart: string, periodEnd: string): void {
    if (periodStart > periodEnd) {
      throw AppError.validation('INVALID_PERIOD', 'O início do período deve ser anterior ao fim.');
    }
  }

  /** Saldo esperado = saldo derivado de todos os lançamentos confirmados até o fim do período. */
  async preview(
    accountId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<ClosingPreview> {
    this.assertPeriod(periodStart, periodEnd);
    const start = startOfDayInZone(periodStart);
    const end = endOfDayExclusive(periodEnd);
    const [opening, expected, grouped, pending] = await Promise.all([
      this.ledger.accountBalance(this.prisma, accountId, start),
      this.ledger.accountBalance(this.prisma, accountId, end),
      this.prisma.financialTransaction.groupBy({
        by: ['direction'],
        where: { accountId, status: 'CONFIRMED', occurredAt: { gte: start, lt: end } },
        _sum: { amount: true }
      }),
      this.prisma.financialTransaction.count({
        where: { accountId, status: 'PENDING', occurredAt: { gte: start, lt: end } }
      })
    ]);

    return {
      accountId,
      periodStart,
      periodEnd,
      openingBalance: moneyView(opening),
      income: moneyView(grouped.find((g) => g.direction === 'INCOME')?._sum.amount ?? null),
      expense: moneyView(grouped.find((g) => g.direction === 'EXPENSE')?._sum.amount ?? null),
      expectedBalance: moneyView(expected),
      pendingTransactions: pending
    };
  }

  async close(
    actor: Principal,
    input: {
      accountId: string;
      periodStart: string;
      periodEnd: string;
      countedBalance: Money;
      notes?: string;
    },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<ClosingView[]> {
    this.assertPeriod(input.periodStart, input.periodEnd);
    const key = `closing:${idempotencyKey}`;

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'account', input.accountId);
      const replay = await tx.cashClosing.findUnique({
        where: { idempotencyKey: key },
        select: { closedById: true }
      });

      if (replay) {
        if (replay.closedById !== actor.userId) {
          throw AppError.conflict('IDEMPOTENCY_CONFLICT', 'Chave de idempotência já utilizada.');
        }

        return;
      }

      const account = await tx.financialAccount.findFirst({
        where: { id: input.accountId, deletedAt: null },
        select: { currency: true }
      });

      if (account === null) {
        throw AppError.notFound('Conta não encontrada.');
      }

      const others = await tx.cashClosing.findMany({
        where: { financialAccountId: input.accountId, status: 'CLOSED' },
        select: { periodStart: true, periodEnd: true }
      });

      if (
        others.some((o) =>
          periodsIntersect(
            { periodStart: dateToCivil(o.periodStart), periodEnd: dateToCivil(o.periodEnd) },
            input
          )
        )
      ) {
        throw AppError.conflict(
          'PERIOD_OVERLAP',
          'Já existe fechamento ativo que cobre parte deste período.'
        );
      }

      const start = startOfDayInZone(input.periodStart);
      const end = endOfDayExclusive(input.periodEnd);
      const pending = await tx.financialTransaction.count({
        where: {
          accountId: input.accountId,
          status: 'PENDING',
          occurredAt: { gte: start, lt: end }
        }
      });

      if (pending > 0) {
        throw AppError.conflict(
          'PENDING_TRANSACTIONS',
          `Há ${pending} lançamento(s) pendente(s) no período. Confirme ou cancele antes de fechar.`
        );
      }

      const expected = round2(await this.ledger.accountBalance(tx, input.accountId, end));
      const counted = round2(input.countedBalance);
      const difference = round2(counted.minus(expected));
      const reopened = await tx.cashClosing.findUnique({
        where: {
          financialAccountId_periodStart_periodEnd: {
            financialAccountId: input.accountId,
            periodStart: civilToDate(input.periodStart),
            periodEnd: civilToDate(input.periodEnd)
          }
        }
      });
      const data = {
        expectedBalance: expected,
        countedBalance: counted,
        differenceAmount: difference,
        currency: account.currency,
        status: 'CLOSED' as const,
        notes: input.notes?.trim() || null,
        closedById: actor.userId,
        closedAt: new Date()
      };
      const closing = reopened
        ? await tx.cashClosing.update({
            where: { id: reopened.id },
            data: { ...data, idempotencyKey: key }
          })
        : await tx.cashClosing.create({
            data: {
              ...data,
              financialAccountId: input.accountId,
              periodStart: civilToDate(input.periodStart),
              periodEnd: civilToDate(input.periodEnd),
              idempotencyKey: key
            }
          });

      await tx.financialTransaction.updateMany({
        where: {
          accountId: input.accountId,
          status: 'CONFIRMED',
          occurredAt: { gte: start, lt: end }
        },
        data: { cashClosingId: closing.id }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: reopened ? 'finance.closing.reclosed' : 'finance.closing.closed',
          entityType: 'CashClosing',
          entityId: closing.id,
          reason: input.notes ?? null,
          ...(reopened
            ? {
                before: {
                  expected: reopened.expectedBalance.toFixed(2),
                  counted: reopened.countedBalance.toFixed(2),
                  status: reopened.status
                }
              }
            : {}),
          after: {
            period: `${input.periodStart}..${input.periodEnd}`,
            expected: expected.toFixed(2),
            counted: counted.toFixed(2),
            difference: difference.toFixed(2)
          },
          meta
        },
        tx
      );
    });

    return this.list(input.accountId);
  }

  /** RN-FIN-011: reabertura exige permissão própria e motivo; histórico preservado na auditoria. */
  async reopen(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<ClosingView[]> {
    const accountId = await this.prisma.$transaction(async (tx) => {
      const closing = await tx.cashClosing.findUnique({ where: { id } });

      if (closing === null) {
        throw AppError.notFound('Fechamento não encontrado.');
      }

      if (closing.status !== 'CLOSED') {
        throw AppError.conflict('NOT_CLOSED', 'Somente fechamentos ativos podem ser reabertos.');
      }

      await tx.cashClosing.update({
        where: { id },
        data: {
          status: 'REOPENED',
          reopenedAt: new Date(),
          reopenedById: actor.userId,
          reopeningReason: reason
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'finance.closing.reopened',
          entityType: 'CashClosing',
          entityId: id,
          reason,
          before: {
            status: 'CLOSED',
            expected: closing.expectedBalance.toFixed(2),
            counted: closing.countedBalance.toFixed(2)
          },
          after: { status: 'REOPENED' },
          meta
        },
        tx
      );

      return closing.financialAccountId;
    });

    return this.list(accountId);
  }
}
