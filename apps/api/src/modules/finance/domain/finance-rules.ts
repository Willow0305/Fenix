import type {
  FinancialDirection,
  FinancialObligationStatus,
  FinancialTransactionStatus,
  MonthlyFeeStatus
} from '../../../generated/prisma/client';

import { daysInMonth } from '../../../common/domain/civil-date';
import { type Money, round2, sum, ZERO } from '../../../common/domain/money';
import type { TransitionTable } from '../../../common/domain/state-machine';

/** Regras puras de mensalidades e Caixa Fênix (RN-MEN-*, RN-FIN-*, DT-027). */

// ---------- Mensalidades ----------

/** Vencimento no mês de referência; dia inexistente vira o último dia do mês. */
export function dueDateFor(referenceMonth: string, dueDay: number): string {
  const day = Math.min(Math.max(dueDay, 1), daysInMonth(referenceMonth));

  return `${referenceMonth.slice(0, 7)}-${String(day).padStart(2, '0')}`;
}

export function feeTotal(original: Money, discount: Money, additional: Money): Money {
  return round2(original.minus(discount).plus(additional));
}

/**
 * Status armazenado após pagamentos (DT-027): pago quando a soma confirmada atinge o
 * total; parcial quando há valor pago menor; aberto sem pagamentos.
 */
export function feeStatusAfterPayments(
  total: Money,
  paid: Money
): Exclude<MonthlyFeeStatus, 'OVERDUE' | 'CANCELLED'> {
  if (paid.greaterThanOrEqualTo(total) && total.greaterThan(0)) {
    return 'PAID';
  }

  if (total.lessThanOrEqualTo(0)) {
    return 'PAID';
  }

  return paid.greaterThan(0) ? 'PARTIALLY_PAID' : 'OPEN';
}

/** Atraso é derivado da data (não depende de rotina agendada). */
export function effectiveFeeStatus(
  stored: MonthlyFeeStatus,
  dueDate: string,
  today: string
): MonthlyFeeStatus {
  if ((stored === 'OPEN' || stored === 'PARTIALLY_PAID') && dueDate < today) {
    return 'OVERDUE';
  }

  return stored;
}

export interface CoverageInput {
  readonly startsOn: string;
  readonly endsOn: string | null;
}

/** O vínculo atleta–plano cobre o mês se houver interseção com o mês de referência. */
export function planCoversMonth(plan: CoverageInput, referenceMonth: string): boolean {
  const monthStart = referenceMonth;
  const monthEnd = `${referenceMonth.slice(0, 7)}-${String(daysInMonth(referenceMonth)).padStart(2, '0')}`;

  return plan.startsOn <= monthEnd && (plan.endsOn === null || plan.endsOn >= monthStart);
}

export function remainingAmount(total: Money, paid: Money): Money {
  const remaining = round2(total.minus(paid));

  return remaining.lessThan(0) ? ZERO : remaining;
}

// ---------- Caixa ----------

export const TRANSACTION_TRANSITIONS: TransitionTable<FinancialTransactionStatus> = {
  DRAFT: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED']
};

export const TRANSACTION_STATUS_LABELS: Record<FinancialTransactionStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado'
};

export interface SignedMovement {
  readonly direction: FinancialDirection;
  readonly amount: Money;
}

export function signedAmount(movement: SignedMovement): Money {
  return movement.direction === 'INCOME' ? movement.amount : movement.amount.negated();
}

/** RN-FIN-002: saldo = soma assinada das movimentações confirmadas informadas. */
export function balanceOf(movements: readonly SignedMovement[]): Money {
  return round2(sum(movements.map(signedAmount)));
}

export function oppositeDirection(direction: FinancialDirection): FinancialDirection {
  return direction === 'INCOME' ? 'EXPENSE' : 'INCOME';
}

export interface ClosedPeriod {
  readonly periodStart: string;
  readonly periodEnd: string;
}

/** Data civil coberta por algum período fechado da conta. */
export function isInClosedPeriod(date: string, closed: readonly ClosedPeriod[]): boolean {
  return closed.some((period) => date >= period.periodStart && date <= period.periodEnd);
}

export function periodsIntersect(a: ClosedPeriod, b: ClosedPeriod): boolean {
  return a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;
}

export function effectiveObligationStatus(
  stored: FinancialObligationStatus,
  dueDate: string,
  today: string
): FinancialObligationStatus {
  return stored === 'OPEN' && dueDate < today ? 'OVERDUE' : stored;
}
