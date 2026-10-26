import type {
  CouponAudience,
  CouponDiscountType,
  CouponScope
} from '../../../generated/prisma/client';

import { type Money, round2, sum, ZERO } from '../../../common/domain/money';

/**
 * Regras puras de cupom (DT-045). Um cupom por pedido. Vale sobre o preço atual do item
 * (já com promoção) e nunca sobre produto de parceiro: o desconto não pode alterar
 * comissão nem repasse (PEN-063).
 */
export interface CouponRule {
  readonly code: string;
  readonly discountType: CouponDiscountType;
  readonly percentage: Money | null;
  readonly amount: Money | null;
  readonly scope: CouponScope;
  readonly audience: CouponAudience;
  readonly minimumOrderAmount: Money | null;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly maxRedemptions: number | null;
  readonly maxPerCustomer: number | null;
  readonly isActive: boolean;
  readonly productIds: ReadonlySet<string>;
  readonly categoryIds: ReadonlySet<string>;
  readonly roleCodes: ReadonlySet<string>;
}

export interface CouponLine {
  readonly productId: string;
  readonly categoryId: string;
  readonly partnerId: string | null;
  readonly total: Money;
}

export interface CouponContext {
  readonly now: Date;
  /** `null` para compra sem login. */
  readonly roles: readonly string[] | null;
  readonly usage: { readonly total: number; readonly byCustomer: number };
}

export type CouponRefusal =
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'CUSTOMER_LIMIT'
  | 'LOGIN_REQUIRED'
  | 'AUDIENCE'
  | 'MINIMUM'
  | 'NO_ELIGIBLE_ITEMS';

export const COUPON_REFUSAL_MESSAGES: Record<CouponRefusal, string> = {
  INACTIVE: 'Este cupom não está disponível.',
  NOT_STARTED: 'Este cupom ainda não começou a valer.',
  EXPIRED: 'Este cupom expirou.',
  EXHAUSTED: 'Este cupom já atingiu o limite de usos.',
  CUSTOMER_LIMIT: 'Você já usou este cupom o número máximo de vezes.',
  LOGIN_REQUIRED: 'Entre na sua conta para usar este cupom.',
  AUDIENCE: 'Este cupom não está disponível para a sua conta.',
  MINIMUM: 'O pedido não atinge o valor mínimo deste cupom.',
  NO_ELIGIBLE_ITEMS: 'Nenhum produto do carrinho participa deste cupom.'
};

export type CouponEvaluation =
  | {
      readonly ok: true;
      readonly discount: Money;
      /** Desconto de cada linha, na mesma ordem de `lines` (zero nas não elegíveis). */
      readonly perLine: readonly Money[];
      readonly eligibleSubtotal: Money;
    }
  | { readonly ok: false; readonly refusal: CouponRefusal; readonly message: string };

/** Código digitado → forma gravada: sem espaços e em maiúsculas. */
export function normalizeCouponCode(code: string): string {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

function refuse(refusal: CouponRefusal): CouponEvaluation {
  return { ok: false, refusal, message: COUPON_REFUSAL_MESSAGES[refusal] };
}

function lineEligible(rule: CouponRule, line: CouponLine): boolean {
  if (line.partnerId !== null) {
    return false;
  }

  switch (rule.scope) {
    case 'PRODUCTS':
      return rule.productIds.has(line.productId);
    case 'CATEGORIES':
      return rule.categoryIds.has(line.categoryId);
    default:
      return true;
  }
}

/**
 * Reparte o desconto entre as linhas elegíveis na proporção de cada total, em centavos;
 * a diferença de arredondamento fica na última linha, para a soma bater exatamente.
 */
export function allocateDiscount(totals: readonly Money[], discount: Money): Money[] {
  const base = sum(totals);

  if (base.isZero() || discount.isZero()) {
    return totals.map(() => ZERO);
  }

  const shares = totals.map((total) => round2(discount.times(total).dividedBy(base)));
  const remainder = discount.minus(sum(shares));
  const lastIndex = totals.reduce((last, total, index) => (total.isZero() ? last : index), 0);

  shares[lastIndex] = (shares[lastIndex] ?? ZERO).plus(remainder);

  return shares;
}

export function evaluateCoupon(
  rule: CouponRule,
  lines: readonly CouponLine[],
  context: CouponContext
): CouponEvaluation {
  if (!rule.isActive) {
    return refuse('INACTIVE');
  }

  if (rule.startsAt && context.now < rule.startsAt) {
    return refuse('NOT_STARTED');
  }

  if (rule.endsAt && context.now > rule.endsAt) {
    return refuse('EXPIRED');
  }

  if (rule.audience !== 'EVERYONE' && context.roles === null) {
    return refuse('LOGIN_REQUIRED');
  }

  if (
    rule.audience === 'ROLES' &&
    !(context.roles ?? []).some((role) => rule.roleCodes.has(role))
  ) {
    return refuse('AUDIENCE');
  }

  if (rule.maxRedemptions !== null && context.usage.total >= rule.maxRedemptions) {
    return refuse('EXHAUSTED');
  }

  if (rule.maxPerCustomer !== null && context.usage.byCustomer >= rule.maxPerCustomer) {
    return refuse('CUSTOMER_LIMIT');
  }

  const subtotal = sum(lines.map((line) => line.total));

  if (rule.minimumOrderAmount !== null && subtotal.lessThan(rule.minimumOrderAmount)) {
    return refuse('MINIMUM');
  }

  const eligible = lines.map((line) => lineEligible(rule, line));
  const eligibleTotals = lines.map((line, index) => (eligible[index] ? line.total : ZERO));
  const eligibleSubtotal = sum(eligibleTotals);

  if (eligibleSubtotal.isZero()) {
    return refuse('NO_ELIGIBLE_ITEMS');
  }

  const raw =
    rule.discountType === 'PERCENTAGE'
      ? round2(eligibleSubtotal.times(rule.percentage ?? ZERO).dividedBy(100))
      : (rule.amount ?? ZERO);
  const discount = raw.greaterThan(eligibleSubtotal) ? eligibleSubtotal : raw;

  return {
    ok: true,
    discount,
    perLine: allocateDiscount(eligibleTotals, discount),
    eligibleSubtotal
  };
}
