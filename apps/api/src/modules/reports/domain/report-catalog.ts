/** Catálogo e formato comum dos relatórios integrados (RF-021, RF-045, DT-035). */

export type ReportKey =
  | 'athletes'
  | 'tryouts'
  | 'fees'
  | 'cash'
  | 'pending-proofs'
  | 'sales-products'
  | 'sales-partners'
  | 'campaigns';

export type CashGrouping = 'category' | 'account' | 'costCenter' | 'origin';

export interface ReportDefinition {
  readonly key: ReportKey;
  readonly title: string;
  readonly description: string;
  /** Relatórios de período exigem `from`/`to`; os demais são retrato do momento. */
  readonly needsPeriod: boolean;
  readonly groupings?: readonly { value: CashGrouping; label: string }[];
}

export const REPORTS: readonly ReportDefinition[] = [
  {
    key: 'athletes',
    title: 'Atletas por status e equipe',
    description: 'Quantidade de atletas em cada situação, por equipe atual (sem dados pessoais).',
    needsPeriod: false
  },
  {
    key: 'tryouts',
    title: 'Inscrições por seletiva',
    description: 'Inscrições recebidas no período, por seletiva e situação.',
    needsPeriod: true
  },
  {
    key: 'fees',
    title: 'Mensalidades e inadimplência por mês',
    description: 'Cobranças por mês de referência: emitido, pago, em aberto e vencido.',
    needsPeriod: true
  },
  {
    key: 'cash',
    title: 'Caixa por agrupamento',
    description: 'Entradas e saídas confirmadas no período (transferências excluídas).',
    needsPeriod: true,
    groupings: [
      { value: 'category', label: 'Categoria' },
      { value: 'account', label: 'Conta' },
      { value: 'costCenter', label: 'Centro de custo' },
      { value: 'origin', label: 'Origem' }
    ]
  },
  {
    key: 'pending-proofs',
    title: 'Comprovantes e lançamentos pendentes',
    description: 'Pagamentos aguardando confirmação e despesas confirmadas sem comprovante.',
    needsPeriod: false
  },
  {
    key: 'sales-products',
    title: 'Vendas por produto',
    description: 'Itens de pedidos pagos no período, por produto e variação.',
    needsPeriod: true
  },
  {
    key: 'sales-partners',
    title: 'Vendas por parceiro',
    description: 'Receita do time (comissão) e valor devido a cada parceiro no período.',
    needsPeriod: true
  },
  {
    key: 'campaigns',
    title: 'Remessas',
    description: 'Situação, unidades e valores pagos por remessa.',
    needsPeriod: false
  }
];

export function reportDefinition(key: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.key === key);
}

export type ColumnKind = 'text' | 'number' | 'money' | 'date' | 'datetime';

export interface ReportColumn {
  readonly key: string;
  readonly label: string;
  readonly kind: ColumnKind;
}

export type ReportCell = string | number | null;

export interface ReportTable {
  readonly key: ReportKey;
  readonly title: string;
  readonly period: { from: string; to: string } | null;
  readonly timeZone: string;
  readonly currency: string;
  readonly generatedAt: string;
  readonly columns: readonly ReportColumn[];
  readonly rows: readonly Record<string, ReportCell>[];
  /** Totais por coluna numérica/monetária, já como string decimal para dinheiro. */
  readonly totals: Record<string, ReportCell> | null;
}

/** Soma colunas numéricas sem float para dinheiro (strings decimais com 2 casas). */
export function columnTotals(
  columns: readonly ReportColumn[],
  rows: readonly Record<string, ReportCell>[],
  add: (a: string, b: string) => string
): Record<string, ReportCell> {
  const totals: Record<string, ReportCell> = {};

  for (const column of columns) {
    if (column.kind === 'number') {
      totals[column.key] = rows.reduce((sum, row) => sum + Number(row[column.key] ?? 0), 0);
    }

    if (column.kind === 'money') {
      totals[column.key] = rows.reduce<string>(
        (sum, row) => add(sum, String(row[column.key] ?? '0')),
        '0.00'
      );
    }
  }

  return totals;
}

/** Período no cabeçalho do CSV: datas civis em formato brasileiro e fuso explícito. */
export function periodLabel(period: { from: string; to: string } | null, timeZone: string): string {
  if (period === null) {
    return `Retrato do momento (${timeZone})`;
  }

  const br = (civil: string) => civil.split('-').reverse().join('/');

  return `${br(period.from)} a ${br(period.to)} (${timeZone})`;
}
