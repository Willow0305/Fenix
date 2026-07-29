import {
  calculateCashClosing,
  createTransferLedgerEffects,
  determineChargeSettlement,
  evaluateReconciliation,
  isLedgerTransitionAllowed,
  parseMoneyToUnits
} from '.';

describe('Phase 3 financial domain rules', () => {
  it('uses exact fixed-point money and rejects floating-point-shaped input', () => {
    expect(parseMoneyToUnits('123.4567')).toBe(1_234_567n);
    expect(() => parseMoneyToUnits('1e3')).toThrow();
    expect(() => parseMoneyToUnits('-1')).toThrow();
  });

  it('keeps a partially paid charge open with the remaining amount', () => {
    expect(determineChargeSettlement('100.00', '35.50')).toBe('PARTIALLY_PAID');
    expect(determineChargeSettlement('100.00', '100.00')).toBe('PAID');
  });

  it('requires an explicit destination for payment surplus', () => {
    expect(() =>
      evaluateReconciliation({
        paymentAmount: '120.00',
        allocationAmounts: ['100.00']
      })
    ).toThrow('destinação explícita');

    expect(
      evaluateReconciliation({
        paymentAmount: '120.00',
        allocationAmounts: ['100.00'],
        surplusDisposition: 'CREDIT'
      })
    ).toEqual({
      allocatedAmount: '100.0000',
      surplusAmount: '20.0000',
      disposition: 'CREDIT'
    });
  });

  it('prevents allocations above the payment', () => {
    expect(() =>
      evaluateReconciliation({
        paymentAmount: '100.00',
        allocationAmounts: ['60.00', '40.01']
      })
    ).toThrow('não pode superar');
  });

  it('represents transfers as neutral paired ledger effects', () => {
    expect(createTransferLedgerEffects('45.00')).toEqual([
      { type: 'TRANSFER_OUT', effect: '-45.0000' },
      { type: 'TRANSFER_IN', effect: '45.0000' }
    ]);
  });

  it('allows approval/rejection from pending and reversal only from approved', () => {
    expect(isLedgerTransitionAllowed('PENDING', 'APPROVED')).toBe(true);
    expect(isLedgerTransitionAllowed('PENDING', 'REJECTED')).toBe(true);
    expect(isLedgerTransitionAllowed('APPROVED', 'REVERSED')).toBe(true);
    expect(isLedgerTransitionAllowed('APPROVED', 'REJECTED')).toBe(false);
    expect(isLedgerTransitionAllowed('REVERSED', 'APPROVED')).toBe(false);
  });

  it('calculates the cash closing and difference without binary floating point', () => {
    expect(
      calculateCashClosing({
        openingBalance: '100.00',
        inflows: '75.25',
        outflows: '20.10',
        adjustments: '0.05',
        countedFinalBalance: '155.25'
      })
    ).toEqual({
      expectedFinalBalance: '155.2000',
      differenceAmount: '0.0500'
    });
  });
});
