import { Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error';

/**
 * Dinheiro sempre em Decimal (DT-006, RN-FIN-001). Entrada e saída da API usam string
 * decimal com até 2 casas; arredondamento comercial (half-up) em 2 casas (PEN-021).
 */
export type Money = Prisma.Decimal;

export const ZERO: Money = new Prisma.Decimal(0);
export const DEFAULT_CURRENCY = 'BRL';
const MONEY_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

export function money(value: string | number | Money): Money {
  return new Prisma.Decimal(value);
}

/** Converte string da API em Decimal, validando formato e sinal (nunca usa float). */
export function parseMoney(
  value: string,
  field = 'amount',
  options: { allowZero?: boolean } = {}
): Money {
  const normalized = value.trim();

  if (!MONEY_PATTERN.test(normalized)) {
    throw AppError.validation('INVALID_AMOUNT', 'Valor inválido.', [
      {
        field,
        code: 'INVALID_AMOUNT',
        message: 'Informe um valor como 89.90 (até 2 casas decimais).'
      }
    ]);
  }

  const amount = new Prisma.Decimal(normalized);

  if (!options.allowZero && amount.lessThanOrEqualTo(0)) {
    throw AppError.validation('INVALID_AMOUNT', 'O valor deve ser maior que zero.', [
      { field, code: 'NOT_POSITIVE', message: 'O valor deve ser maior que zero.' }
    ]);
  }

  return round2(amount);
}

export function round2(value: Money): Money {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sum(values: readonly Money[]): Money {
  return values.reduce<Money>((total, value) => total.plus(value), ZERO);
}

/** Serialização para a API: string com 2 casas. */
export function toMoneyString(value: Money | null | undefined): string {
  return round2(value ?? ZERO).toFixed(2);
}

export interface MoneyView {
  readonly amount: string;
  readonly currency: string;
}

export function moneyView(value: Money | null | undefined, currency = DEFAULT_CURRENCY): MoneyView {
  return { amount: toMoneyString(value), currency };
}
