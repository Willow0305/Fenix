'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import { Icon } from '../../../components/icon';
import {
  Alert,
  ClearFilters,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  Skeleton,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { FEE_STATUS, type Fee, type FeeStatus, type MoneyView } from '../../../lib/finance-types';
import { formatDate, formatMoney, formatMonth, todayCivil } from '../../../lib/format';
import type { Team } from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';
import { useUrlFilters } from '../../../lib/use-url-filters';
import { teamOptions } from '../../../lib/team-options';

type FeePage = Page<Fee> & { totals?: { amount: MoneyView } };

function FeesList() {
  const { can } = useAuth();
  const filters = useUrlFilters({
    mes: todayCivil().slice(0, 7),
    situacao: '',
    equipe: '',
    atleta: ''
  });
  const { mes: month, situacao: status, equipe: teamId, atleta: term } = filters.values;
  const page = filters.page;
  const [search, setSearch] = useState(term);

  useEffect(() => setSearch(term), [term]);
  const teams = useResource<Team[]>('/teams');
  const fees = useResource<FeePage>('/monthly-fees', {
    page,
    pageSize: 30,
    referenceMonth: month,
    status,
    teamId,
    search: term
  });
  const [generateMonth, setGenerateMonth] = useState(todayCivil().slice(0, 7));
  const generate = useSubmit(async () => {
    const result = await api<{ created: number; skipped: number }>('/monthly-fees/generate', {
      method: 'POST',
      body: { referenceMonth: generateMonth }
    });

    generate.setMessage(
      `${result.created} mensalidade(s) gerada(s); ${result.skipped} já existiam.`
    );
    filters.set({ mes: generateMonth });
    await fees.reload();
  });

  return (
    <>
      <PageHeader
        title="Mensalidades"
        description="Cobranças por atleta e mês. Atraso é calculado pela data de vencimento."
      />

      {can('fees.generate') ? (
        <form className="card row" onSubmit={(event) => void generate.submit(event)}>
          <label className="field">
            <span className="label">Gerar mensalidades do mês</span>
            <input
              type="month"
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={generate.pending}>
            <Icon name="lightning-charge" /> {generate.pending ? 'Gerando…' : 'Gerar'}
          </button>
          <span className="muted">Atletas ativos com plano vigente. Repetir não duplica.</span>
          {generate.message ? <Alert kind="success">{generate.message}</Alert> : null}
          <ErrorSummary error={generate.error} />
        </form>
      ) : null}

      <form
        className="row filter-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          filters.set({ atleta: search.trim() });
        }}
      >
        <label className="field">
          <span className="label">Mês</span>
          <input
            type="month"
            value={month}
            onChange={(e) => filters.set({ mes: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => filters.set({ situacao: e.target.value as FeeStatus | '' })}
          >
            <option value="">Todas</option>
            {Object.entries(FEE_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Equipe</span>
          <select value={teamId} onChange={(e) => filters.set({ equipe: e.target.value })}>
            <option value="">Todas</option>
            {teamOptions(teams.data ?? [], 'filter').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Atleta</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome"
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary">
            <Icon name="search" /> Filtrar
          </button>
          <button type="button" className="btn btn-link" onClick={() => filters.set({ mes: '' })}>
            Todos os meses
          </button>
          <ClearFilters active={filters.active} onClear={filters.clear} />
        </div>
      </form>

      {fees.error ? <Alert kind="error">{fees.error}</Alert> : null}
      {fees.loading && !fees.data ? <Loading /> : null}
      {fees.data?.data.length === 0 ? <Empty>Nenhuma mensalidade para os filtros.</Empty> : null}
      {fees.data && fees.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Atleta</th>
                  <th scope="col">Mês</th>
                  <th scope="col">Vencimento</th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col" className="num">
                    Pago
                  </th>
                  <th scope="col" className="num">
                    Em aberto
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {fees.data.data.map((fee) => (
                  <tr key={fee.id}>
                    <td data-label="Atleta">
                      <Link href={`/admin/mensalidades/${fee.id}`}>{fee.athlete.fullName}</Link>
                    </td>
                    <td data-label="Mês">{formatMonth(fee.referenceMonth)}</td>
                    <td data-label="Vencimento">{formatDate(fee.dueDate)}</td>
                    <td data-label="Total" className="num">
                      {formatMoney(fee.totalAmount.amount)}
                    </td>
                    <td data-label="Pago" className="num">
                      {formatMoney(fee.paidAmount.amount)}
                    </td>
                    <td data-label="Em aberto" className="num">
                      {formatMoney(fee.remainingAmount.amount)}
                    </td>
                    <td data-label="Situação">
                      <span className={`badge ${FEE_STATUS[fee.status].badge}`}>
                        {FEE_STATUS[fee.status].label}
                      </span>
                      {fee.pendingAmount.amount !== '0.00' ? (
                        <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                          comprovante
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fees.data.totals ? (
            <p className="muted">
              Total cobrado nos filtros: {formatMoney(fees.data.totals.amount.amount)}
            </p>
          ) : null}
        </>
      ) : null}
      {fees.data ? <Pagination {...fees.data.meta} onChange={filters.setPage} /> : null}
    </>
  );
}

export default function FeesPage() {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <FeesList />
    </Suspense>
  );
}
