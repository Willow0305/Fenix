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

describe('regras da loja', () => {
  const product = { basePrice: money('100'), promotionalPrice: null };
  const variant = { priceOverride: null, promotionalPriceOverride: null };

  it('escolhe o preço efetivo', () => {
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

  it('acompanha estoque disponível e reservado em todo o ciclo do pedido', () => {
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

  it('mantém o sinal do ajuste como informado', () => {
    expect(signedDelta('ADJUSTMENT', -4)).toBe(-4);
    expect(signedDelta('LOSS', 4)).toBe(-4);
    expect(signedDelta('RETURN', 2)).toBe(2);
  });

  it('só vende produto ativo, físico e dentro do período', () => {
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

  it('calcula totais com decimais', () => {
    expect(lineTotal({ unitPrice: money('19.99'), quantity: 3 }).toFixed(2)).toBe('59.97');
    expect(
      orderTotal([
        { unitPrice: money('0.10'), quantity: 3 },
        { unitPrice: money('0.20'), quantity: 1 }
      ]).toFixed(2)
    ).toBe('0.50');
  });

  it('só chega a pago pela confirmação do pagamento', () => {
    expect(canTransition(ORDER_TRANSITIONS, 'AWAITING_PAYMENT', 'PAID')).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, 'PAID', 'READY_FOR_PICKUP')).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, 'CANCELLED', 'PAID')).toBe(false);
  });

  it('gera números de pedido não sequenciais e confere o limite por comprador', () => {
    expect(generateOrderNumber(new Date('2026-10-18T00:00:00Z'))).toMatch(
      /^FNX-261018-[A-HJ-NP-Z2-9]{6}$/
    );
    expect(buyerLimitExceeded(2, 1, 2)).toBe(true);
    expect(buyerLimitExceeded(null, 10, 10)).toBe(false);
  });
});
