'use client';

import Link from 'next/link';
import { useState } from 'react';

import { IncomeExpenseChart, OverdueRateChart } from '../../../../components/finance-charts';
import { Icon } from '../../../../components/icon';
import { Alert, Loading, PageHeader } from '../../../../components/ui';
import { formatDateTime, formatMoney, formatMonth } from '../../../../lib/format';
import { useResource } from '../../../../lib/use-resource';

interface Money {
  readonly amount: string;
}

interface FinanceTrend {
  readonly generatedAt: string;
  readonly months: readonly {
    readonly month: string;
    readonly income: Money;
    readonly expense: Money;
    readonly result: Money;
    readonly fees: { billedDue: Money; overdue: Money; overdueRate: string | null } | null;
  }[];
  readonly expectedNext30Days: Money | null;
}

const PERIODS = [6, 12, 24] as const;

/**
 * Painel financeiro (DT-058): números do mês, receita × despesa e inadimplência por mês.
 * Tudo vem dos lançamentos confirmados e das mensalidades; nada é digitado à mão.
 */
export default function FinanceDashboardPage() {
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(12);
  const trend = useResource<FinanceTrend>('/finance/trend', { months });
  const [table, setTable] = useState(false);
  const data = trend.data;
  const current = data?.months[data.months.length - 1];
  const lastRate = data?.months
    .slice()
    .reverse()
    .find((month) => month.fees?.overdueRate !== null && month.fees !== null);

  return (
    <>
      <PageHeader
        title="Painel financeiro"
        description="Calculado dos lançamentos confirmados do Caixa e das mensalidades. Transferências entre contas não contam como receita nem despesa."
        actions={
          <Link href="/admin/caixa">
            <Icon name="arrow-left" /> Caixa
          </Link>
        }
      />
      <div className="row" role="group" aria-label="Período">
        {PERIODS.map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${value === months ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={value === months}
            onClick={() => setMonths(value)}
          >
            Últimos {value} meses
          </button>
        ))}
        <span className="spacer" />
        <button type="button" className="btn btn-link" onClick={() => setTable(!table)}>
          <Icon name={table ? 'bar-chart' : 'table'} /> {table ? 'Ver gráficos' : 'Ver tabela'}
        </button>
      </div>
      {trend.error ? <Alert kind="error">{trend.error}</Alert> : null}
      {!data ? <Loading /> : null}
      {data && current ? (
        <div className={trend.loading ? 'is-refreshing stack' : 'stack'}>
          <dl className="stat-row">
            <div className="stat-tile">
              <dt>Receita em {formatMonth(`${current.month}-01`)}</dt>
              <dd>{formatMoney(current.income.amount)}</dd>
            </div>
            <div className="stat-tile">
              <dt>Despesa em {formatMonth(`${current.month}-01`)}</dt>
              <dd>{formatMoney(current.expense.amount)}</dd>
            </div>
            <div className="stat-tile">
              <dt>Resultado do mês</dt>
              <dd>{formatMoney(current.result.amount)}</dd>
            </div>
            {lastRate?.fees ? (
              <div className="stat-tile">
                <dt>Inadimplência ({formatMonth(`${lastRate.month}-01`)})</dt>
                <dd>{Number(lastRate.fees.overdueRate).toLocaleString('pt-BR')}%</dd>
                <small className="muted">
                  {formatMoney(lastRate.fees.overdue.amount)} de{' '}
                  {formatMoney(lastRate.fees.billedDue.amount)} vencidos
                </small>
              </div>
            ) : null}
            {data.expectedNext30Days ? (
              <div className="stat-tile">
                <dt>Previsto nos próximos 30 dias</dt>
                <dd>{formatMoney(data.expectedNext30Days.amount)}</dd>
                <small className="muted">Mensalidades em aberto a vencer</small>
              </div>
            ) : null}
          </dl>

          {table ? (
            <div className="table-wrap">
              <table className="table table-stack">
                <caption className="visually-hidden">Valores por mês</caption>
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col" className="num">
                      Receita
                    </th>
                    <th scope="col" className="num">
                      Despesa
                    </th>
                    <th scope="col" className="num">
                      Resultado
                    </th>
                    {current.fees ? (
                      <th scope="col" className="num">
                        Inadimplência
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((row) => (
                    <tr key={row.month}>
                      <td data-label="Mês">{formatMonth(`${row.month}-01`)}</td>
                      <td data-label="Receita" className="num">
                        {formatMoney(row.income.amount)}
                      </td>
                      <td data-label="Despesa" className="num">
                        {formatMoney(row.expense.amount)}
                      </td>
                      <td data-label="Resultado" className="num">
                        {formatMoney(row.result.amount)}
                      </td>
                      {row.fees ? (
                        <td data-label="Inadimplência" className="num">
                          {row.fees.overdueRate === null
                            ? '—'
                            : `${Number(row.fees.overdueRate).toLocaleString('pt-BR')}%`}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-grid-layout">
              <section className="card">
                <IncomeExpenseChart
                  data={data.months.map((row) => ({
                    month: row.month,
                    income: Number(row.income.amount),
                    expense: Number(row.expense.amount)
                  }))}
                />
              </section>
              {current.fees ? (
                <section className="card">
                  <OverdueRateChart
                    data={data.months.map((row) => ({
                      month: row.month,
                      rate: row.fees?.overdueRate ?? null
                    }))}
                  />
                  <p className="muted m-0">
                    Do valor das mensalidades de cada mês que já venceram, quanto ainda está em
                    aberto.
                  </p>
                </section>
              ) : null}
            </div>
          )}
          <small className="muted">Atualizado em {formatDateTime(data.generatedAt)}.</small>
        </div>
      ) : null}
    </>
  );
}
