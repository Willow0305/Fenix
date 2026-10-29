import {
  cardMethodCode,
  effectiveInterestFree,
  interestFreeLimit,
  parseDifferentialPricing,
  rejectionMessage
} from './card-payment';

describe('cartão pelo site (DT-079)', () => {
  it('sem juros do pedido é a menor regra; produto sem regra deixa só com juros', () => {
    expect(interestFreeLimit([6, 3, 12])).toBe(3);
    expect(interestFreeLimit([6, null])).toBe(0);
    expect(interestFreeLimit([])).toBe(0);
  });

  it('usa o maior código do intermediário que não passa do limite', () => {
    const codes = parseDifferentialPricing({
      '3': 'dp-3',
      '6': ' dp-6 ',
      '13': 'x',
      '1': 'y',
      a: 'z'
    });

    expect([...codes.entries()]).toEqual([
      [3, 'dp-3'],
      [6, 'dp-6']
    ]);
    expect(effectiveInterestFree(5, codes, false)).toEqual({
      upTo: 3,
      differentialPricingId: 'dp-3'
    });
    expect(effectiveInterestFree(12, codes, false)).toEqual({
      upTo: 6,
      differentialPricingId: 'dp-6'
    });
    expect(effectiveInterestFree(2, codes, false)).toEqual({
      upTo: 0,
      differentialPricingId: null
    });
    // Modo de teste: sem código, vale o limite configurado nos produtos.
    expect(effectiveInterestFree(4, new Map(), true)).toEqual({
      upTo: 4,
      differentialPricingId: null
    });
    expect(effectiveInterestFree(1, codes, true)).toEqual({ upTo: 0, differentialPricingId: null });
  });

  it('método do Caixa e motivo da recusa em português', () => {
    expect(cardMethodCode('debit_card')).toBe('cartao-debito');
    expect(cardMethodCode('credit_card')).toBe('cartao-credito');
    expect(rejectionMessage('cc_rejected_insufficient_amount')).toBe(
      'Limite insuficiente no cartão.'
    );
    expect(rejectionMessage('qualquer')).toContain('Cartão recusado');
    expect(rejectionMessage(null)).toContain('Cartão recusado');
  });
});
