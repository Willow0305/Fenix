import { createHash } from 'node:crypto';

import { type Money, money, moneyView, type MoneyView, round2 } from '../../../common/domain/money';

/**
 * Prestação de contas (DT-103): retrato do Caixa Fênix num período, para a diretoria e os
 * atletas (fora do site). Funções puras: classificam os lançamentos confirmados, somam,
 * conferem que os números fecham e geram o código de conferência do documento emitido.
 *
 * - entradas só em totais por categoria, sem nome de quem pagou (LGPD);
 * - cada saída da diretoria (lançamento manual, ajuste, repasse a parceiro) numa linha, com a
 *   descrição do Caixa (que pode ter o nome de quem recebeu) só quando a diretoria marcar;
 * - estornos e devoluções a compradores e atletas somados por categoria, sem nomes;
 * - transferências entre contas não são entrada nem saída; saldo inicial lançado no período
 *   aparece à parte.
 */
export const SNAPSHOT_FORMAT = 1;

export type LedgerDirection = 'INCOME' | 'EXPENSE';

export type LedgerOrigin =
  | 'MANUAL'
  | 'MONTHLY_FEE'
  | 'ORDER'
  | 'REFUND'
  | 'PARTNER_SETTLEMENT'
  | 'TRANSFER'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT';

/** Lançamento confirmado do período, como vem do banco. */
export interface LedgerRow {
  readonly id: string;
  readonly accountId: string;
  readonly direction: LedgerDirection;
  readonly origin: LedgerOrigin;
  readonly amount: string;
  /** Data civil do lançamento no fuso do time. */
  readonly date: string;
  readonly categoryName: string;
  readonly description: string;
  /** Quem recebeu, quando a saída quitou uma conta a pagar. */
  readonly counterpartyName: string | null;
}

export interface AccountOpening {
  readonly accountId: string;
  readonly accountName: string;
  /** Saldo antes do primeiro dia do período. */
  readonly opening: string;
}

export interface ExpenseLine {
  readonly transactionId: string;
  readonly date: string;
  readonly category: string;
  readonly amount: MoneyView;
  /** Descrição do Caixa e quem recebeu: só quando a diretoria marcou. */
  readonly detail: string | null;
}

export interface CategoryTotal {
  readonly category: string;
  readonly total: MoneyView;
}

export interface Signatory {
  readonly name: string;
  readonly position: string | null;
}

export interface AccountabilityContent {
  readonly period: { readonly from: string; readonly to: string; readonly timeZone: string };
  readonly currency: string;
  readonly openingBalance: MoneyView;
  /** Saldo inicial de conta nova lançado dentro do período. */
  readonly openingEntries: MoneyView;
  readonly income: { readonly byCategory: readonly CategoryTotal[]; readonly total: MoneyView };
  readonly expense: {
    readonly lines: readonly ExpenseLine[];
    /** Estornos e devoluções a compradores e atletas, por categoria (sem nomes). */
    readonly refunds: readonly CategoryTotal[];
    readonly total: MoneyView;
  };
  /** Entradas menos saídas do período. */
  readonly result: MoneyView;
  readonly closingBalance: MoneyView;
  readonly accounts: readonly {
    readonly name: string;
    readonly opening: MoneyView;
    readonly closing: MoneyView;
  }[];
}

/** Saídas que vão uma por linha: as decididas pela diretoria. */
const LISTED_EXPENSE_ORIGINS: ReadonlySet<LedgerOrigin> = new Set<LedgerOrigin>([
  'MANUAL',
  'ADJUSTMENT',
  'PARTNER_SETTLEMENT'
]);

function totalsByCategory(rows: readonly LedgerRow[], currency: string): CategoryTotal[] {
  const totals = new Map<string, Money>();

  for (const row of rows) {
    totals.set(row.categoryName, (totals.get(row.categoryName) ?? money(0)).plus(row.amount));
  }

  return [...totals.entries()]
    .sort((a, b) => b[1].comparedTo(a[1]) || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([category, total]) => ({ category, total: moneyView(round2(total), currency) }));
}

function sum(rows: readonly LedgerRow[]): Money {
  return rows.reduce((total, row) => total.plus(row.amount), money(0));
}

function signed(row: LedgerRow): Money {
  return row.direction === 'INCOME' ? money(row.amount) : money(row.amount).negated();
}

/**
 * Monta o conteúdo da prestação de contas. `showDetailFor` são os lançamentos de saída cuja
 * descrição (com quem recebeu) a diretoria marcou para aparecer.
 */
export function buildAccountability(input: {
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly accounts: readonly AccountOpening[];
  readonly rows: readonly LedgerRow[];
  readonly showDetailFor: ReadonlySet<string>;
}): AccountabilityContent {
  const { currency } = input;
  const view = (value: Money) => moneyView(round2(value), currency);
  const rows = [...input.rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );
  const operational = rows.filter(
    (row) => row.origin !== 'TRANSFER' && row.origin !== 'OPENING_BALANCE'
  );
  const openingEntries = rows.filter((row) => row.origin === 'OPENING_BALANCE');
  const incomeRows = operational.filter((row) => row.direction === 'INCOME');
  const expenseRows = operational.filter((row) => row.direction === 'EXPENSE');
  const listed = expenseRows.filter((row) => LISTED_EXPENSE_ORIGINS.has(row.origin));
  const listedIds = new Set(listed.map((row) => row.id));
  const refunds = expenseRows.filter((row) => !listedIds.has(row.id));
  const opening = input.accounts.reduce((total, a) => total.plus(a.opening), money(0));
  const income = sum(incomeRows);
  const expense = sum(expenseRows);
  const entries = openingEntries.reduce((total, row) => total.plus(signed(row)), money(0));
  const result = income.minus(expense);
  const closing = opening.plus(entries).plus(result);
  const accounts = input.accounts
    .map((account) => {
      const moved = rows
        .filter((row) => row.accountId === account.accountId)
        .reduce((total, row) => total.plus(signed(row)), money(0));

      return {
        name: account.accountName,
        opening: view(money(account.opening)),
        closing: view(money(account.opening).plus(moved))
      };
    })
    .filter(
      (account) =>
        !money(account.opening.amount).isZero() || !money(account.closing.amount).isZero()
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return {
    period: { from: input.from, to: input.to, timeZone: input.timeZone },
    currency,
    openingBalance: view(opening),
    openingEntries: view(entries),
    income: { byCategory: totalsByCategory(incomeRows, currency), total: view(income) },
    expense: {
      lines: listed.map((row) => ({
        transactionId: row.id,
        date: row.date,
        category: row.categoryName,
        amount: view(money(row.amount)),
        detail: input.showDetailFor.has(row.id)
          ? [
              row.description.trim(),
              row.counterpartyName ? `Recebido por ${row.counterpartyName}` : ''
            ]
              .filter(Boolean)
              .join(' · ')
          : null
      })),
      refunds: totalsByCategory(refunds, currency),
      total: view(expense)
    },
    result: view(result),
    closingBalance: view(closing),
    accounts
  };
}

/**
 * Os números fecham? Saldo final = inicial + saldos lançados + entradas − saídas, e a soma
 * das contas bate com o total. Retorna a lista de problemas (vazia quando está tudo certo).
 */
export function consistencyProblems(content: AccountabilityContent): string[] {
  const problems: string[] = [];
  const expected = money(content.openingBalance.amount)
    .plus(content.openingEntries.amount)
    .plus(content.income.total.amount)
    .minus(content.expense.total.amount);

  if (!expected.equals(content.closingBalance.amount)) {
    problems.push('O saldo final não fecha com entradas e saídas.');
  }

  const listed = content.expense.lines.reduce((t, l) => t.plus(l.amount.amount), money(0));
  const refunds = content.expense.refunds.reduce((t, r) => t.plus(r.total.amount), money(0));

  if (!listed.plus(refunds).equals(content.expense.total.amount)) {
    problems.push('As saídas listadas não somam o total de saídas.');
  }

  const accounts = content.accounts.reduce((t, a) => t.plus(a.closing.amount), money(0));

  if (!accounts.equals(content.closingBalance.amount)) {
    problems.push('A soma das contas não bate com o saldo final.');
  }

  return problems;
}

/** JSON com as chaves em ordem: o mesmo conteúdo sempre gera o mesmo texto e o mesmo hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function contentHash(snapshot: unknown): string {
  return createHash('sha256').update(canonicalJson(snapshot), 'utf8').digest('hex');
}

/** Código de conferência impresso no documento: 12 primeiros caracteres do hash, em 3 grupos. */
export function verificationCode(hash: string): string {
  const head = hash.slice(0, 12).toUpperCase();

  return `${head.slice(0, 4)}-${head.slice(4, 8)}-${head.slice(8, 12)}`;
}

/** Aceita o código com ou sem traços, em minúsculas ou maiúsculas. */
export function normalizeVerificationCode(value: string): string | null {
  const clean = value.replace(/[^0-9a-f]/gi, '').toLowerCase();

  return clean.length === 12 ? clean : null;
}

/** Número do documento: `PC-2026-001`, sequência por ano de emissão. */
export function reportNumber(year: number, sequence: number): string {
  return `PC-${year}-${String(sequence).padStart(3, '0')}`;
}

/** Período válido: datas reais, início até o fim, no máximo 2 anos (como os relatórios). */
export function periodProblem(from: string, to: string): string | null {
  if (from > to) {
    return 'A data inicial precisa ser antes da final.';
  }

  const start = new Date(`${from}T00:00:00Z`);
  const limit = new Date(start);

  limit.setUTCFullYear(limit.getUTCFullYear() + 2);

  return new Date(`${to}T00:00:00Z`) >= limit ? 'O período pode ter no máximo 2 anos.' : null;
}
