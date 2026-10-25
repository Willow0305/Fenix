import { money, sum } from '../../../common/domain/money';
import {
  allocateDiscount,
  type CouponLine,
  type CouponRule,
  evaluateCoupon,
  normalizeCouponCode
} from './coupon-rules';

const NOW = new Date('2026-10-25T12:00:00Z');

function rule(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    code: 'FENIX10',
    discountType: 'PERCENTAGE',
    percentage: money('10'),
    amount: null,
    scope: 'ALL',
    audience: 'EVERYONE',
    minimumOrderAmount: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    maxPerCustomer: null,
    isActive: true,
    productIds: new Set(),
    categoryIds: new Set(),
    roleCodes: new Set(),
    ...overrides
  };
}

const LINES: CouponLine[] = [
  { productId: 'camisa', categoryId: 'uniformes', partnerId: null, total: money('100.00') },
  { productId: 'bone', categoryId: 'acessorios', partnerId: null, total: money('50.00') },
  { productId: 'fisio', categoryId: 'servicos', partnerId: 'parceiro', total: money('80.00') }
];

const ctx = (overrides: Partial<Parameters<typeof evaluateCoupon>[2]> = {}) => ({
  now: NOW,
  roles: ['user'],
  usage: { total: 0, byCustomer: 0 },
  ...overrides
});

describe('cupons (DT-045)', () => {
  it('normaliza o código', () => {
    expect(normalizeCouponCode(' fenix 10 ')).toBe('FENIX10');
  });

  it('percentual sobre os produtos do Fênix, nunca sobre produto de parceiro', () => {
    const result = evaluateCoupon(rule(), LINES, ctx());

    expect(result.ok && result.discount.toFixed(2)).toBe('15.00');
    expect(result.ok && result.perLine.map((v) => v.toFixed(2))).toEqual(['10.00', '5.00', '0.00']);
  });

  it('valor fixo limitado ao subtotal elegível', () => {
    const result = evaluateCoupon(
      rule({
        discountType: 'FIXED',
        percentage: null,
        amount: money('500'),
        scope: 'PRODUCTS',
        productIds: new Set(['bone'])
      }),
      LINES,
      ctx()
    );

    expect(result.ok && result.discount.toFixed(2)).toBe('50.00');
  });

  it('por categoria', () => {
    const result = evaluateCoupon(
      rule({ scope: 'CATEGORIES', categoryIds: new Set(['uniformes']) }),
      LINES,
      ctx()
    );

    expect(result.ok && result.discount.toFixed(2)).toBe('10.00');
  });

  it.each([
    ['inativo', rule({ isActive: false }), ctx(), 'INACTIVE'],
    ['antes do início', rule({ startsAt: new Date('2026-11-01') }), ctx(), 'NOT_STARTED'],
    ['vencido', rule({ endsAt: new Date('2026-10-01') }), ctx(), 'EXPIRED'],
    [
      'esgotado',
      rule({ maxRedemptions: 5 }),
      ctx({ usage: { total: 5, byCustomer: 0 } }),
      'EXHAUSTED'
    ],
    [
      'limite por cliente',
      rule({ maxPerCustomer: 1 }),
      ctx({ usage: { total: 1, byCustomer: 1 } }),
      'CUSTOMER_LIMIT'
    ],
    ['sem login', rule({ audience: 'LOGGED_IN' }), ctx({ roles: null }), 'LOGIN_REQUIRED'],
    ['papel errado', rule({ audience: 'ROLES', roleCodes: new Set(['board']) }), ctx(), 'AUDIENCE'],
    ['abaixo do mínimo', rule({ minimumOrderAmount: money('300') }), ctx(), 'MINIMUM'],
    [
      'sem item elegível',
      rule({ scope: 'PRODUCTS', productIds: new Set(['fisio']) }),
      ctx(),
      'NO_ELIGIBLE_ITEMS'
    ]
  ])('recusa: %s', (_case, coupon, context, refusal) => {
    const result = evaluateCoupon(coupon, LINES, context);

    expect(result.ok ? null : result.refusal).toBe(refusal);
  });

  it('aceita o papel certo (ex.: diretoria, atletas)', () => {
    const result = evaluateCoupon(
      rule({ audience: 'ROLES', roleCodes: new Set(['board', 'athlete']) }),
      LINES,
      ctx({ roles: ['user', 'athlete'] })
    );

    expect(result.ok).toBe(true);
  });

  it('reparte o desconto em centavos sem sobra', () => {
    const shares = allocateDiscount(
      [money('33.33'), money('33.33'), money('33.34')],
      money('10.00')
    );

    expect(sum(shares).toFixed(2)).toBe('10.00');
    expect(shares.map((s) => s.toFixed(2))).toEqual(['3.33', '3.33', '3.34']);
  });
});
