'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { FEE_STATUS, type Fee, type FeeStatus, type MoneyView } from '../../../lib/finance-types';
import { formatDate, formatMoney, formatMonth, todayCivil } from '../../../lib/format';
import type { Team } from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';

type FeePage = Page<Fee> & { totals?: { amount: MoneyView } };

export default function FeesPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(todayCivil().slice(0, 7));
  const [status, setStatus] = useState<FeeStatus | ''>('');
  const [teamId, setTeamId] = useState('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const teams = useResource<Team[]>('/teams', { includeInactive: false });
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
    setMonth(generateMonth);
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
            {generate.pending ? 'Gerando…' : 'Gerar'}
          </button>
          <span className="muted">Atletas ativos com plano vigente. Repetir não duplica.</span>
          {generate.message ? <Alert kind="success">{generate.message}</Alert> : null}
          <ErrorSummary error={generate.error} />
        </form>
      ) : null}

      <form
        className="row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setTerm(search);
        }}
      >
        <label className="field">
          <span className="label">Mês</span>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setPage(1);
              setMonth(e.target.value);
            }}
          />
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as FeeStatus | '');
            }}
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
          <select
            value={teamId}
            onChange={(e) => {
              setPage(1);
              setTeamId(e.target.value);
            }}
          >
            <option value="">Todas</option>
            {(teams.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
        <button type="button" className="btn btn-link" onClick={() => setMonth('')}>
          Todos os meses
        </button>
      </form>

      {fees.error ? <Alert kind="error">{fees.error}</Alert> : null}
      {fees.loading && !fees.data ? <Loading /> : null}
      {fees.data?.data.length === 0 ? <Empty>Nenhuma mensalidade para os filtros.</Empty> : null}
      {fees.data && fees.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table">
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
                    <td>
                      <Link href={`/admin/mensalidades/${fee.id}`}>{fee.athlete.fullName}</Link>
                    </td>
                    <td>{formatMonth(fee.referenceMonth)}</td>
                    <td>{formatDate(fee.dueDate)}</td>
                    <td className="num">{formatMoney(fee.totalAmount.amount)}</td>
                    <td className="num">{formatMoney(fee.paidAmount.amount)}</td>
                    <td className="num">{formatMoney(fee.remainingAmount.amount)}</td>
                    <td>
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
      {fees.data ? <Pagination {...fees.data.meta} onChange={setPage} /> : null}
    </>
  );
}
