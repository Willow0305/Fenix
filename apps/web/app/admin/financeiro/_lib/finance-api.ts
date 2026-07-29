'use client';

import { ApiError, apiRequest } from '../../../lib/api-client';

export interface CollectionResponse<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export interface NamedRecord {
  readonly id: string;
  readonly name: string;
}

export interface FinancialAccountRecord extends NamedRecord {
  readonly code: string;
  readonly type: 'BANK' | 'CASH' | 'DIGITAL_WALLET' | 'OTHER';
  readonly currency: string;
  readonly isActive: boolean;
}

export interface FinancialCategoryRecord extends NamedRecord {
  readonly code: string;
  readonly type: 'EXPENSE' | 'INCOME';
  readonly isActive: boolean;
}

export interface CostCenterRecord extends NamedRecord {
  readonly code: string;
  readonly isActive: boolean;
}

export interface FinancialPlanVersionRecord {
  readonly id: string;
  readonly version: number;
  readonly amount: string;
  readonly currency: string;
  readonly billingDay: number;
  readonly effectiveFrom: string;
}

export interface FinancialPlanRecord extends NamedRecord {
  readonly code: string;
  readonly status: string;
  readonly description: string | null;
  readonly versions: readonly FinancialPlanVersionRecord[];
}

export interface FinancialChargeRecord {
  readonly id: string;
  readonly referenceCode: string;
  readonly description: string;
  readonly competence: string;
  readonly dueDate: string;
  readonly originalAmount: string;
  readonly allocatedAmount: string;
  readonly outstandingAmount: string;
  readonly currency: string;
  readonly status: string;
}

export interface FinancialPaymentRecord {
  readonly id: string;
  readonly account: NamedRecord;
  readonly amount: string;
  readonly currency: string;
  readonly paidAt: string;
  readonly status: string;
  readonly reconciliationId: string | null;
  readonly surplus: { readonly amount: string; readonly disposition: string } | null;
  readonly credit: { readonly remainingAmount: string; readonly status: string } | null;
}

export interface FinancialTransactionRecord {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly amount: string;
  readonly currency: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly account: NamedRecord;
  readonly category: NamedRecord | null;
  readonly reversalId: string | null;
  readonly reversalOfId: string | null;
}

export interface FinancialTransferRecord {
  readonly id: string;
  readonly sourceAccount: NamedRecord;
  readonly targetAccount: NamedRecord;
  readonly amount: string;
  readonly currency: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly status: string;
  readonly ledgerRowCount: number;
}

export interface FinancialObligationRecord {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly referenceCode: string;
  readonly description: string;
  readonly dueDate: string;
  readonly amount: string;
  readonly currency: string;
  readonly approvedSettlementAmount: string;
  readonly category: FinancialCategoryRecord;
}

export interface CashSessionRecord {
  readonly id: string;
  readonly account: FinancialAccountRecord;
  readonly openingBalance: string;
  readonly status: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly transactionCount: number;
  readonly closing: {
    readonly inflows: string;
    readonly outflows: string;
    readonly adjustments: string;
    readonly expectedFinalBalance: string;
    readonly countedFinalBalance: string;
    readonly differenceAmount: string;
  } | null;
}

export interface FinanceSummary {
  readonly currency: string;
  readonly accounts: number;
  readonly openCharges: number;
  readonly pendingPayments: number;
  readonly pendingEntries: number;
  readonly openCashSessions: number;
  readonly derivedBalance: string;
}

export function getFinanceSummary(): Promise<FinanceSummary> {
  return apiRequest<FinanceSummary>('/finance/summary');
}

export function listFinanceRecords<T>(path: string): Promise<CollectionResponse<T>> {
  return apiRequest<CollectionResponse<T>>(`/finance${path}`);
}

export function createFinanceRecord<T>(
  path: string,
  body: Readonly<Record<string, unknown>>,
  idempotent = false
): Promise<T> {
  return apiRequest<T>(`/finance${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(idempotent
      ? {
          headers: {
            'Idempotency-Key': crypto.randomUUID()
          }
        }
      : {})
  });
}

export function formatMoney(value: string, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency
  }).format(Number(value));
}

export function formatCivilDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  );
}

export function formatInstant(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function getFinanceError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
