import { formatMoneyUnits, parseMoneyToUnits } from './money';

export type ChargeSettlementStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID';
export type LedgerDecisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVERSED';
export type SurplusDisposition = 'CREDIT' | 'RETURN_PENDING' | 'REVIEW_REQUIRED';

export function determineChargeSettlement(
  originalAmount: string,
  allocatedAmount: string
): ChargeSettlementStatus {
  const original = parseMoneyToUnits(originalAmount);
  const allocated = parseMoneyToUnits(allocatedAmount, { allowZero: true });

  if (allocated > original) {
    throw new RangeError('A cobrança não pode receber alocação superior ao valor original.');
  }

  if (allocated === 0n) {
    return 'OPEN';
  }

  return allocated === original ? 'PAID' : 'PARTIALLY_PAID';
}

export function evaluateReconciliation(input: {
  readonly paymentAmount: string;
  readonly allocationAmounts: readonly string[];
  readonly surplusDisposition?: SurplusDisposition;
}): {
  readonly allocatedAmount: string;
  readonly surplusAmount: string;
  readonly disposition: SurplusDisposition | null;
} {
  const payment = parseMoneyToUnits(input.paymentAmount);
  const allocated = input.allocationAmounts.reduce(
    (total, amount) => total + parseMoneyToUnits(amount),
    0n
  );

  if (allocated > payment) {
    throw new RangeError('A soma das alocações não pode superar o pagamento.');
  }

  const surplus = payment - allocated;

  if (surplus > 0n && !input.surplusDisposition) {
    throw new RangeError('Pagamento excedente exige destinação explícita.');
  }

  if (surplus === 0n && input.surplusDisposition) {
    throw new RangeError('Não informe destinação quando não houver excedente.');
  }

  return {
    allocatedAmount: formatMoneyUnits(allocated),
    surplusAmount: formatMoneyUnits(surplus),
    disposition: surplus > 0n ? (input.surplusDisposition ?? null) : null
  };
}

export function isLedgerTransitionAllowed(
  from: LedgerDecisionStatus,
  to: LedgerDecisionStatus
): boolean {
  if (from === 'PENDING') {
    return to === 'APPROVED' || to === 'REJECTED';
  }

  return from === 'APPROVED' && to === 'REVERSED';
}

export function createTransferLedgerEffects(
  amount: string
): readonly [
  { readonly type: 'TRANSFER_OUT'; readonly effect: string },
  { readonly type: 'TRANSFER_IN'; readonly effect: string }
] {
  const units = parseMoneyToUnits(amount);

  return [
    { type: 'TRANSFER_OUT', effect: formatMoneyUnits(-units) },
    { type: 'TRANSFER_IN', effect: formatMoneyUnits(units) }
  ];
}

export function calculateCashClosing(input: {
  readonly openingBalance: string;
  readonly inflows: string;
  readonly outflows: string;
  readonly adjustments: string;
  readonly countedFinalBalance: string;
}): {
  readonly expectedFinalBalance: string;
  readonly differenceAmount: string;
} {
  const opening = parseMoneyToUnits(input.openingBalance, { allowZero: true });
  const inflows = parseMoneyToUnits(input.inflows, { allowZero: true });
  const outflows = parseMoneyToUnits(input.outflows, { allowZero: true });
  const adjustments = parseMoneyToUnits(input.adjustments, {
    allowNegative: true,
    allowZero: true
  });
  const counted = parseMoneyToUnits(input.countedFinalBalance, { allowZero: true });
  const expected = opening + inflows - outflows + adjustments;

  if (expected < 0n) {
    throw new RangeError('O saldo final esperado do caixa não pode ser negativo.');
  }

  return {
    expectedFinalBalance: formatMoneyUnits(expected),
    differenceAmount: formatMoneyUnits(counted - expected)
  };
}
