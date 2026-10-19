import { money } from '../../../common/domain/money';
import { canTransition } from '../../../common/domain/state-machine';
import {
  availableStock,
  buyerLimitExceeded,
  effectiveUnitPrice,
  generateOrderNumber,
  isPurchasable,
  lineTotal,
  ORDER_TRANSITIONS,
  orderTotal,
  reservedStock,
  signedDelta
} from './store-rules';

describe('store rules', () => {
  const product = { basePrice: money('100'), promotionalPrice: null };
  const variant = { priceOverride: null, promotionalPriceOverride: null };

  it('chooses the effective price', () => {
    expect(effectiveUnitPrice(product, variant).toFixed(2)).toBe('100.00');
    expect(
      effectiveUnitPrice({ ...product, promotionalPrice: money('80') }, variant).toFixed(2)
    ).toBe('80.00');
    expect(
      effectiveUnitPrice(
        { ...product, promotionalPrice: money('80') },
        { ...variant, priceOverride: money('120') }
      ).toFixed(2)
    ).toBe('120.00');
    expect(
      effectiveUnitPrice(product, {
        priceOverride: money('120'),
        promotionalPriceOverride: money('99.90')
      }).toFixed(2)
    ).toBe('99.90');
    expect(
      effectiveUnitPrice({ ...product, promotionalPrice: money('150') }, variant).toFixed(2)
    ).toBe('100.00');
  });

  it('tracks available and reserved stock through the order lifecycle', () => {
    const movements = [
      { type: 'STOCK_IN' as const, quantityDelta: signedDelta('STOCK_IN', 10) },
      { type: 'RESERVATION' as const, quantityDelta: signedDelta('RESERVATION', 3) },
      { type: 'RESERVATION' as const, quantityDelta: signedDelta('RESERVATION', 2) }
    ];

    expect(availableStock(movements)).toBe(5);
    expect(reservedStock(movements)).toBe(5);

    // Pedido de 3 pago: libera a reserva e registra a saída efetiva.
    const paid = [
      ...movements,
      { type: 'RELEASE' as const, quantityDelta: 3 },
      { type: 'STOCK_OUT' as const, quantityDelta: -3 }
    ];

    expect(availableStock(paid)).toBe(5);
    expect(reservedStock(paid)).toBe(2);

    // Pedido de 2 cancelado: libera a reserva.
    const cancelled = [...paid, { type: 'RELEASE' as const, quantityDelta: 2 }];

    expect(availableStock(cancelled)).toBe(7);
    expect(reservedStock(cancelled)).toBe(0);
  });

  it('keeps adjustments signed as informed', () => {
    expect(signedDelta('ADJUSTMENT', -4)).toBe(-4);
    expect(signedDelta('LOSS', 4)).toBe(-4);
    expect(signedDelta('RETURN', 2)).toBe(2);
  });

  it('only sells active, physical, in-window products', () => {
    const base = {
      status: 'ACTIVE' as const,
      fulfillmentType: 'STOCK' as const,
      availableFrom: null,
      availableUntil: null
    };
    const now = new Date('2026-10-18T12:00:00Z');

    expect(isPurchasable(base, now)).toBe(true);
    expect(isPurchasable({ ...base, status: 'DRAFT' }, now)).toBe(false);
    expect(isPurchasable({ ...base, fulfillmentType: 'DIGITAL' }, now)).toBe(false);
    expect(isPurchasable({ ...base, availableUntil: new Date('2026-10-17T00:00:00Z') }, now)).toBe(
      false
    );
  });

  it('computes totals with decimals', () => {
    expect(lineTotal({ unitPrice: money('19.99'), quantity: 3 }).toFixed(2)).toBe('59.97');
    expect(
      orderTotal([
        { unitPrice: money('0.10'), quantity: 3 },
        { unitPrice: money('0.20'), quantity: 1 }
      ]).toFixed(2)
    ).toBe('0.50');
  });

  it('only reaches PAID through payment confirmation', () => {
    expect(canTransition(ORDER_TRANSITIONS, 'AWAITING_PAYMENT', 'PAID')).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, 'PAID', 'READY_FOR_PICKUP')).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, 'CANCELLED', 'PAID')).toBe(false);
  });

  it('generates non-sequential order numbers and checks buyer limits', () => {
    expect(generateOrderNumber(new Date('2026-10-18T00:00:00Z'))).toMatch(
      /^FNX-261018-[A-HJ-NP-Z2-9]{6}$/
    );
    expect(buyerLimitExceeded(2, 1, 2)).toBe(true);
    expect(buyerLimitExceeded(null, 10, 10)).toBe(false);
  });
});
