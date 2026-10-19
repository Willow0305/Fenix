export interface MoneyView {
  amount: string;
  currency: string;
}

export type FeeStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';
export type Direction = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type Origin =
  | 'MANUAL'
  | 'MONTHLY_FEE'
  | 'ORDER'
  | 'REFUND'
  | 'PARTNER_SETTLEMENT'
  | 'TRANSFER'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT';
export type ObligationType = 'PAYABLE' | 'RECEIVABLE';
export type ObligationStatus = 'OPEN' | 'SETTLED' | 'OVERDUE' | 'CANCELLED';
export type CategoryNature = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type AccountType = 'CASH' | 'BANK' | 'PIX' | 'WALLET' | 'CARD_CLEARING' | 'OTHER';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  amount: MoneyView;
  dueDay: number;
  status: 'ACTIVE' | 'INACTIVE';
  activeAthletes: number;
}

export interface AthletePlan {
  id: string;
  plan: { id: string; name: string };
  startsOn: string;
  endsOn: string | null;
  amountOverride: MoneyView | null;
  effectiveAmount: MoneyView;
  status: string;
}

export interface Payment {
  id: string;
  amount: MoneyView;
  status: PaymentStatus;
  method: { id: string; name: string };
  paidAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  transactionId: string | null;
  attachments: { id: string; fileName: string }[];
}

export interface Fee {
  id: string;
  athlete: { id: string; fullName: string };
  plan: { id: string; name: string };
  referenceMonth: string;
  dueDate: string;
  originalAmount: MoneyView;
  discountAmount: MoneyView;
  additionalAmount: MoneyView;
  totalAmount: MoneyView;
  paidAmount: MoneyView;
  pendingAmount: MoneyView;
  remainingAmount: MoneyView;
  status: FeeStatus;
  cancellationReason: string | null;
  notes: string | null;
}

export interface FeeDetail extends Fee {
  payments: Payment[];
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currency: string;
  institutionName: string | null;
  accountLastFour: string | null;
  isActive: boolean;
}

export interface FinanceCategory {
  id: string;
  code: string;
  name: string;
  nature: CategoryNature;
  isActive: boolean;
  isSystem: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  direction: Direction;
  origin: Origin;
  status: TransactionStatus;
  amount: MoneyView;
  account: { id: string; name: string };
  category: { id: string; name: string };
  costCenter: { id: string; name: string } | null;
  paymentMethod: { id: string; name: string } | null;
  occurredAt: string | null;
  occurredOn: string | null;
  competenceDate: string;
  description: string;
  notes: string | null;
  createdBy: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  cancellationReason: string | null;
  reversesTransactionId: string | null;
  reversedBy: string | null;
  paymentId: string | null;
  attachments: { id: string; fileName: string; mediaFileId: string }[];
  reconciledAt: string | null;
}

export interface FinanceSummary {
  period: { from: string; to: string; timeZone: string };
  generatedAt: string;
  balances: { accountId: string; accountName: string; balance: MoneyView }[];
  totalBalance: MoneyView;
  periodIncome: MoneyView;
  periodExpense: MoneyView;
  periodResult: MoneyView;
  byCategory: {
    categoryId: string;
    categoryName: string;
    direction: Direction;
    total: MoneyView;
  }[];
  byOrigin: { origin: Origin; direction: Direction; total: MoneyView }[];
  pendingTransactions: number;
  pendingReceipts: number;
  pendingPayments: number;
  openReceivables: MoneyView;
  openPayables: MoneyView;
  openFees: { count: number; remaining: MoneyView; overdue: number };
}

export interface Obligation {
  id: string;
  type: ObligationType;
  status: ObligationStatus;
  category: { id: string; name: string };
  costCenter: { id: string; name: string } | null;
  counterpartyName: string;
  description: string;
  competenceDate: string;
  dueDate: string;
  amount: MoneyView;
  settledAt: string | null;
  settlementTransactionId: string | null;
  cancellationReason: string | null;
  notes: string | null;
}

export interface Closing {
  id: string;
  account: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  expectedBalance: MoneyView;
  countedBalance: MoneyView;
  differenceAmount: MoneyView;
  status: 'DRAFT' | 'CLOSED' | 'REOPENED';
  notes: string | null;
  closedBy: string | null;
  closedAt: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopeningReason: string | null;
}

export interface ClosingPreview {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: MoneyView;
  income: MoneyView;
  expense: MoneyView;
  expectedBalance: MoneyView;
  pendingTransactions: number;
}

export const FEE_STATUS: Record<FeeStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Em aberto', badge: 'badge-info' },
  PARTIALLY_PAID: { label: 'Parcial', badge: 'badge-warning' },
  PAID: { label: 'Paga', badge: 'badge-success' },
  OVERDUE: { label: 'Atrasada', badge: 'badge-danger' },
  CANCELLED: { label: 'Cancelada', badge: '' }
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Aguardando confirmação', badge: 'badge-warning' },
  PROCESSING: { label: 'Processando', badge: 'badge-info' },
  CONFIRMED: { label: 'Confirmado', badge: 'badge-success' },
  FAILED: { label: 'Falhou', badge: 'badge-danger' },
  CANCELLED: { label: 'Cancelado', badge: '' },
  PARTIALLY_REFUNDED: { label: 'Reembolso parcial', badge: 'badge-warning' },
  REFUNDED: { label: 'Estornado', badge: 'badge-danger' }
};

export const TRANSACTION_STATUS: Record<TransactionStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Rascunho', badge: '' },
  PENDING: { label: 'Pendente', badge: 'badge-warning' },
  CONFIRMED: { label: 'Confirmado', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelado', badge: '' }
};

export const ORIGIN_LABEL: Record<Origin, string> = {
  MANUAL: 'Manual',
  MONTHLY_FEE: 'Mensalidade',
  ORDER: 'Pedido da loja',
  REFUND: 'Reembolso',
  PARTNER_SETTLEMENT: 'Repasse a parceiro',
  TRANSFER: 'Transferência',
  OPENING_BALANCE: 'Saldo inicial',
  ADJUSTMENT: 'Estorno/ajuste'
};

export const OBLIGATION_STATUS: Record<ObligationStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Em aberto', badge: 'badge-info' },
  OVERDUE: { label: 'Vencida', badge: 'badge-danger' },
  SETTLED: { label: 'Quitada', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelada', badge: '' }
};

export const ACCOUNT_TYPE: Record<AccountType, string> = {
  CASH: 'Caixa (dinheiro)',
  BANK: 'Conta bancária',
  PIX: 'Conta PIX',
  WALLET: 'Carteira digital',
  CARD_CLEARING: 'Recebíveis de cartão',
  OTHER: 'Outra'
};
