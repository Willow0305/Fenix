import { addMonths } from '../../../common/domain/civil-date';
import { type Money, money, round2, ZERO } from '../../../common/domain/money';

/** Os `count` meses que terminam no mês de `today`, do mais antigo ao atual ("AAAA-MM"). */
export function monthsBack(today: string, count: number): string[] {
  const current = `${today.slice(0, 7)}-01`;

  return Array.from({ length: count }, (_, index) =>
    addMonths(current, index - (count - 1)).slice(0, 7)
  );
}

/**
 * Inadimplência do mês (DT-058): valor ainda em aberto das mensalidades daquele mês que
 * já venceram, dividido pelo valor cobrado delas. Sem mensalidade vencida, não há taxa.
 */
export function overdueRate(billedDue: Money, overdue: Money): string | null {
  if (billedDue.lessThanOrEqualTo(0)) {
    return null;
  }

  return round2(overdue.dividedBy(billedDue).times(100)).toFixed(1);
}

export interface MonthAmounts {
  readonly month: string;
  readonly amount: string;
}

export interface FeeMonthRow {
  readonly month: string;
  readonly billedDue: string;
  readonly overdue: string;
}

export interface TrendMonth {
  readonly month: string;
  readonly income: Money;
  readonly expense: Money;
  readonly billedDue: Money;
  readonly overdue: Money;
  readonly overdueRate: string | null;
}

/** Junta as somas do banco em uma linha por mês; mês sem movimento vale zero. */
export function buildTrend(
  months: readonly string[],
  income: readonly MonthAmounts[],
  expense: readonly MonthAmounts[],
  fees: readonly FeeMonthRow[]
): TrendMonth[] {
  const pick = (rows: readonly MonthAmounts[], month: string) =>
    money(rows.find((row) => row.month === month)?.amount ?? ZERO);

  return months.map((month) => {
    const fee = fees.find((row) => row.month === month);
    const billedDue = money(fee?.billedDue ?? ZERO);
    const overdue = money(fee?.overdue ?? ZERO);

    return {
      month,
      income: pick(income, month),
      expense: pick(expense, month),
      billedDue,
      overdue,
      overdueRate: overdueRate(billedDue, overdue)
    };
  });
}
