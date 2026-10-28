import type {
  FinancialAccountType,
  FinancialCategoryNature,
  PaymentMethodType
} from '../../../generated/prisma/client';

/**
 * Plano inicial provisório (RF-027, PEN-020). Categorias marcadas como `system` são
 * usadas por lançamentos automáticos e não podem ser inativadas.
 */
export const SYSTEM_CATEGORY = {
  monthlyFees: 'mensalidades',
  storeSales: 'vendas-loja',
  partnerSales: 'vendas-parceiros',
  /** Taxa de entrega em casa (DT-075). */
  deliveryFees: 'entregas',
  partnerPayouts: 'repasses-parceiros',
  refunds: 'reembolsos',
  transfers: 'transferencias',
  openingBalance: 'saldo-inicial'
} as const;

export interface CategorySeed {
  readonly code: string;
  readonly name: string;
  readonly nature: FinancialCategoryNature;
  readonly system?: boolean;
}

export const DEFAULT_CATEGORIES: readonly CategorySeed[] = [
  { code: SYSTEM_CATEGORY.monthlyFees, name: 'Mensalidades', nature: 'INCOME', system: true },
  { code: SYSTEM_CATEGORY.storeSales, name: 'Vendas da loja', nature: 'INCOME', system: true },
  {
    code: SYSTEM_CATEGORY.partnerSales,
    name: 'Vendas de parceiros',
    nature: 'INCOME',
    system: true
  },
  { code: SYSTEM_CATEGORY.deliveryFees, name: 'Entregas', nature: 'INCOME', system: true },
  { code: SYSTEM_CATEGORY.openingBalance, name: 'Saldo inicial', nature: 'INCOME', system: true },
  { code: 'patrocinios', name: 'Patrocínios e doações', nature: 'INCOME' },
  { code: 'eventos', name: 'Eventos e rifas', nature: 'INCOME' },
  { code: 'outras-receitas', name: 'Outras receitas', nature: 'INCOME' },
  { code: SYSTEM_CATEGORY.refunds, name: 'Reembolsos e estornos', nature: 'EXPENSE', system: true },
  {
    code: SYSTEM_CATEGORY.partnerPayouts,
    name: 'Repasses a parceiros',
    nature: 'EXPENSE',
    system: true
  },
  { code: 'material-esportivo', name: 'Material esportivo', nature: 'EXPENSE' },
  { code: 'aluguel-quadra', name: 'Aluguel de quadra', nature: 'EXPENSE' },
  { code: 'taxas', name: 'Taxas e tarifas', nature: 'EXPENSE' },
  { code: 'transporte', name: 'Transporte', nature: 'EXPENSE' },
  { code: 'uniformes', name: 'Uniformes e malharia', nature: 'EXPENSE' },
  {
    code: 'arbitragem-inscricoes',
    name: 'Arbitragem e inscrições em campeonatos',
    nature: 'EXPENSE'
  },
  { code: 'outras-despesas', name: 'Outras despesas', nature: 'EXPENSE' },
  {
    code: SYSTEM_CATEGORY.transfers,
    name: 'Transferências entre contas',
    nature: 'TRANSFER',
    system: true
  }
];

export const SYSTEM_CATEGORY_CODES: ReadonlySet<string> = new Set(
  DEFAULT_CATEGORIES.filter((category) => category.system).map((category) => category.code)
);

export interface AccountSeed {
  readonly code: string;
  readonly name: string;
  readonly type: FinancialAccountType;
}

export const DEFAULT_ACCOUNTS: readonly AccountSeed[] = [
  { code: 'caixa-fisico', name: 'Caixa físico (dinheiro)', type: 'CASH' },
  { code: 'conta-pix', name: 'Conta bancária / PIX', type: 'BANK' }
];

export interface PaymentMethodSeed {
  readonly code: string;
  readonly name: string;
  readonly type: PaymentMethodType;
}

export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethodSeed[] = [
  { code: 'pix', name: 'PIX', type: 'PIX' },
  { code: 'dinheiro', name: 'Dinheiro', type: 'CASH' },
  { code: 'transferencia', name: 'Transferência bancária', type: 'BANK_TRANSFER' },
  { code: 'cartao-debito', name: 'Cartão de débito', type: 'DEBIT_CARD' },
  { code: 'cartao-credito', name: 'Cartão de crédito', type: 'CREDIT_CARD' }
];
