import type { MoneyView } from './finance-types';

/** Prestação de contas (DT-103), como a API devolve. */
export interface CategoryTotal {
  readonly category: string;
  readonly total: MoneyView;
}

export interface ExpenseLine {
  readonly transactionId: string;
  readonly date: string;
  readonly category: string;
  readonly amount: MoneyView;
  readonly detail: string | null;
}

export interface AccountabilityContent {
  readonly period: { readonly from: string; readonly to: string; readonly timeZone: string };
  readonly currency: string;
  readonly openingBalance: MoneyView;
  readonly openingEntries: MoneyView;
  readonly income: { readonly byCategory: readonly CategoryTotal[]; readonly total: MoneyView };
  readonly expense: {
    readonly lines: readonly ExpenseLine[];
    readonly refunds: readonly CategoryTotal[];
    readonly total: MoneyView;
  };
  readonly result: MoneyView;
  readonly closingBalance: MoneyView;
  readonly accounts: readonly {
    readonly name: string;
    readonly opening: MoneyView;
    readonly closing: MoneyView;
  }[];
}

export interface BoardMember {
  readonly userId: string;
  readonly name: string;
  readonly position: string | null;
}

export interface AccountabilityPreview {
  readonly content: AccountabilityContent;
  readonly problems: readonly string[];
  readonly expenseCandidates: readonly {
    readonly transactionId: string;
    readonly description: string;
    readonly counterpartyName: string | null;
  }[];
  readonly boardMembers: readonly BoardMember[];
  readonly unclosedAccounts: number;
}

export interface AccountabilityRow {
  readonly id: string;
  readonly number: string;
  readonly revision: number;
  readonly status: 'ISSUED' | 'REPLACED';
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly verificationCode: string;
  readonly issuedAt: string;
  readonly issuedBy: string | null;
  readonly closingBalance: string;
  readonly replacedById: string | null;
}

export interface AccountabilityDetail extends AccountabilityRow {
  readonly snapshot: {
    readonly content: AccountabilityContent;
    readonly notes: string | null;
    readonly signatories: readonly { readonly name: string; readonly position: string | null }[];
    readonly replaces: { readonly revision: number; readonly reason: string } | null;
  };
}

export type PeriodShortcut =
  'last-month' | 'this-month' | 'last-quarter' | 'last-year' | 'this-year';

export const PERIOD_SHORTCUTS: readonly {
  readonly value: PeriodShortcut;
  readonly label: string;
}[] = [
  { value: 'last-month', label: 'Mês passado' },
  { value: 'this-month', label: 'Este mês' },
  { value: 'last-quarter', label: 'Trimestre passado' },
  { value: 'last-year', label: 'Ano passado' },
  { value: 'this-year', label: 'Este ano' }
];

function lastDay(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function first(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Datas do atalho a partir de hoje (data civil `AAAA-MM-DD` no fuso do time). */
export function periodFor(shortcut: PeriodShortcut, today: string): { from: string; to: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  switch (shortcut) {
    case 'this-month':
      return { from: first(year, month), to: today };
    case 'last-month': {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;

      return { from: first(y, m), to: lastDay(y, m) };
    }
    case 'last-quarter': {
      const quarter = Math.floor((month - 1) / 3);
      const y = quarter === 0 ? year - 1 : year;
      const startMonth = quarter === 0 ? 10 : (quarter - 1) * 3 + 1;

      return { from: first(y, startMonth), to: lastDay(y, startMonth + 2) };
    }
    case 'last-year':
      return { from: first(year - 1, 1), to: `${year - 1}-12-31` };
    case 'this-year':
      return { from: first(year, 1), to: today };
  }
}
