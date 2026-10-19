import { Injectable } from '@nestjs/common';
import type { FinancialDirection, FinancialOrigin } from '@prisma/client';

import { civilToDate, todayIn } from '../../../common/domain/civil-date';
import { money, type MoneyView, moneyView, sum, ZERO } from '../../../common/domain/money';
import {
  endOfDayExclusive,
  startOfDayInZone,
  TEAM_TIME_ZONE
} from '../../../common/domain/time-zone';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { type AccountBalance, LedgerService } from './ledger.service';

export interface CategoryTotal {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly direction: FinancialDirection;
  readonly total: MoneyView;
}

export interface FinanceSummary {
  readonly period: { from: string; to: string; timeZone: string };
  readonly generatedAt: string;
  readonly balances: AccountBalance[];
  readonly totalBalance: MoneyView;
  readonly periodIncome: MoneyView;
  readonly periodExpense: MoneyView;
  readonly periodResult: MoneyView;
  readonly byCategory: CategoryTotal[];
  readonly byOrigin: { origin: FinancialOrigin; direction: FinancialDirection; total: MoneyView }[];
  readonly pendingTransactions: number;
  readonly pendingReceipts: number;
  readonly pendingPayments: number;
  readonly openReceivables: MoneyView;
  readonly openPayables: MoneyView;
  readonly openFees: { count: number; remaining: MoneyView; overdue: number };
}

/**
 * Visão do Caixa e relatório inicial (RF-025, RF-045). Todos os totais derivam dos
 * lançamentos; o relatório informa período, fuso, moeda e instante de geração.
 */
@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

  async summary(from: string, to: string): Promise<FinanceSummary> {
    const start = startOfDayInZone(from);
    const end = endOfDayExclusive(to);
    const periodWhere = { status: 'CONFIRMED' as const, occurredAt: { gte: start, lt: end } };
    const today = civilToDate(todayIn());
    const [
      balances,
      byCategoryRaw,
      byOriginRaw,
      pendingTransactions,
      pendingReceipts,
      pendingPayments,
      obligations,
      openFees,
      categories
    ] = await Promise.all([
      this.ledger.balances(),
      this.prisma.financialTransaction.groupBy({
        by: ['categoryId', 'direction'],
        where: { ...periodWhere, origin: { not: 'TRANSFER' } },
        _sum: { amount: true }
      }),
      this.prisma.financialTransaction.groupBy({
        by: ['origin', 'direction'],
        where: periodWhere,
        _sum: { amount: true }
      }),
      this.prisma.financialTransaction.count({ where: { status: 'PENDING' } }),
      this.prisma.financialTransaction.count({
        where: {
          status: 'CONFIRMED',
          origin: 'MANUAL',
          direction: 'EXPENSE',
          attachments: { none: { deletedAt: null } }
        }
      }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.financialObligation.groupBy({
        by: ['type'],
        where: { status: 'OPEN' },
        _sum: { amount: true }
      }),
      this.prisma.monthlyFee.findMany({
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
        select: {
          totalAmount: true,
          dueDate: true,
          paymentAllocations: {
            where: { payment: { status: 'CONFIRMED' } },
            select: { allocatedAmount: true }
          }
        }
      }),
      this.prisma.financialCategory.findMany({ select: { id: true, name: true } })
    ]);
    const byCategory = byCategoryRaw
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: categories.find((c) => c.id === row.categoryId)?.name ?? '—',
        direction: row.direction,
        total: moneyView(row._sum.amount ?? ZERO)
      }))
      .sort((a, b) => money(b.total.amount).comparedTo(money(a.total.amount)));
    // Transferências não são receita nem despesa do time (RN-FIN-009).
    const income = sum(
      byCategoryRaw.filter((r) => r.direction === 'INCOME').map((r) => money(r._sum.amount ?? ZERO))
    );
    const expense = sum(
      byCategoryRaw
        .filter((r) => r.direction === 'EXPENSE')
        .map((r) => money(r._sum.amount ?? ZERO))
    );
    const remaining = sum(
      openFees.map((fee) => {
        const paid = sum(fee.paymentAllocations.map((a) => a.allocatedAmount));
        const left = fee.totalAmount.minus(paid);

        return left.lessThan(0) ? ZERO : left;
      })
    );

    return {
      period: { from, to, timeZone: TEAM_TIME_ZONE },
      generatedAt: new Date().toISOString(),
      balances,
      totalBalance: moneyView(sum(balances.map((b) => money(b.balance.amount)))),
      periodIncome: moneyView(income),
      periodExpense: moneyView(expense),
      periodResult: moneyView(income.minus(expense)),
      byCategory,
      byOrigin: byOriginRaw.map((row) => ({
        origin: row.origin,
        direction: row.direction,
        total: moneyView(row._sum.amount ?? ZERO)
      })),
      pendingTransactions,
      pendingReceipts,
      pendingPayments,
      openReceivables: moneyView(
        obligations.find((o) => o.type === 'RECEIVABLE')?._sum.amount ?? ZERO
      ),
      openPayables: moneyView(obligations.find((o) => o.type === 'PAYABLE')?._sum.amount ?? ZERO),
      openFees: {
        count: openFees.length,
        remaining: moneyView(remaining),
        overdue: openFees.filter((fee) => fee.dueDate < today).length
      }
    };
  }
}
