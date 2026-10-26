'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Icon } from '../../../../components/icon';
import { PlanForm } from '../../../../components/plan-form';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  Skeleton,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import type { BulkAssignResult, Plan, PlanMember } from '../../../../lib/finance-types';
import { formatDate, formatMoney, todayCivil } from '../../../../lib/format';
import { normalizeAmount } from '../../../../lib/idempotency';
import {
  ATHLETE_STATUS,
  type AthleteStatus,
  type AthleteSummary
} from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

/** Primeiro dia do mês seguinte, sugestão de início para quem entra no plano. */
function nextMonthStart(): string {
  const [y, m] = todayCivil().split('-').map(Number) as [number, number];

  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** Seleção de atletas com busca; a seleção é mantida entre buscas. */
function AthletePicker({
  selected,
  onToggle,
  currentIds
}: {
  readonly selected: ReadonlyMap<string, string>;
  readonly onToggle: (athlete: AthleteSummary) => void;
  readonly currentIds: ReadonlySet<string>;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<AthleteStatus | ''>('ACTIVE');
  const athletes = useResource<Page<AthleteSummary>>('/athletes', {
    pageSize: 50,
    search: term,
    status
  });

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <form
        className="row filter-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search.trim());
        }}
      >
        <label className="field">
          <span className="label">Buscar atleta</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou e-mail"
          />
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as AthleteStatus | '')}>
            <option value="">Todos</option>
            {Object.entries(ATHLETE_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary">
            <Icon name="search" /> Buscar
          </button>
        </div>
      </form>
      {athletes.loading && !athletes.data ? <Skeleton lines={3} /> : null}
      {athletes.data?.data.length === 0 ? <Empty>Nenhum atleta encontrado.</Empty> : null}
      {athletes.data && athletes.data.data.length > 0 ? (
        <ul className="pick-list" aria-label="Atletas encontrados">
          {athletes.data.data.map((athlete) => {
            const inPlan = currentIds.has(athlete.id);

            return (
              <li key={athlete.id}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    disabled={inPlan}
                    checked={inPlan || selected.has(athlete.id)}
                    onChange={() => onToggle(athlete)}
                  />
                  <span>
                    {athlete.fullName}{' '}
                    <span className={`badge ${ATHLETE_STATUS[athlete.status].badge}`}>
                      {ATHLETE_STATUS[athlete.status].label}
                    </span>
                    {inPlan ? <small className="muted"> · já está neste plano</small> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const plans = useResource<Plan[]>('/fee-plans');
  const members = useResource<PlanMember[]>(`/fee-plans/${id}/athletes`);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [form, setForm] = useState({
    startsOn: nextMonthStart(),
    amountOverride: '',
    reason: '',
    replaceCurrent: false
  });
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  const [ending, setEnding] = useState<PlanMember | null>(null);
  const [endsOn, setEndsOn] = useState(todayCivil());
  const [notice, setNotice] = useState<string | null>(null);
  const manage = can('fees.plans.manage');
  const plan = plans.data?.find((p) => p.id === id);
  const current = (members.data ?? []).filter((m) => m.status === 'ACTIVE' && !m.endsOn);
  const past = (members.data ?? []).filter((m) => !(m.status === 'ACTIVE' && !m.endsOn));
  const currentIds = new Set(current.map((m) => m.athlete.id));

  const assign = useSubmit(async () => {
    const response = await api<BulkAssignResult>(`/fee-plans/${id}/athletes`, {
      method: 'POST',
      body: {
        athleteIds: [...selected.keys()],
        startsOn: form.startsOn,
        replaceCurrent: form.replaceCurrent,
        ...(form.amountOverride ? { amountOverride: normalizeAmount(form.amountOverride) } : {}),
        ...(form.reason ? { reason: form.reason } : {})
      }
    });

    setResult(response);
    setSelected(new Map());
    await Promise.all([members.reload(), plans.reload()]);
  });

  if (!plans.data) {
    return plans.error ? <Alert kind="error">{plans.error}</Alert> : <Skeleton lines={5} />;
  }

  if (!plan) {
    return <Alert kind="error">Plano não encontrado.</Alert>;
  }

  return (
    <>
      <PageHeader
        title={plan.name}
        description={`${formatMoney(plan.amount.amount)} por mês · vence todo dia ${plan.dueDay}${plan.status === 'ACTIVE' ? '' : ' · plano inativo'}`}
        actions={
          <>
            {manage ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing((v) => !v)}
              >
                <Icon name="pencil" /> {editing ? 'Fechar edição' : 'Editar plano'}
              </button>
            ) : null}
            <Link href="/admin/planos">
              <Icon name="arrow-left" /> Planos
            </Link>
          </>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {plan.description ? <p className="prose">{plan.description}</p> : null}

      {editing ? (
        <section className="card">
          <PlanForm
            source={plan}
            submitLabel="Salvar alterações"
            onSubmit={async (payload) => {
              await api(`/fee-plans/${id}`, { method: 'PATCH', body: payload });
              setEditing(false);
              setNotice('Plano atualizado.');
              await plans.reload();
            }}
            onCancel={() => setEditing(false)}
          />
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="vigentes">
        <div className="row">
          <h2 id="vigentes" style={{ margin: 0 }}>
            Quem paga este plano ({current.length})
          </h2>
          <span className="spacer" />
          {manage && plan.status === 'ACTIVE' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                setAdding((v) => !v);
              }}
            >
              <Icon name="person-plus" /> {adding ? 'Fechar' : 'Adicionar atletas'}
            </button>
          ) : null}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Só atletas com status Ativo recebem cobrança ao gerar o mês. Pendentes entram no plano,
          mas só são cobrados depois de ativados.
        </p>

        {adding ? (
          <div className="card stack">
            <h3 style={{ margin: 0 }}>Adicionar atletas ao plano</h3>
            <AthletePicker
              selected={selected}
              currentIds={currentIds}
              onToggle={(athlete) =>
                setSelected((prev) => {
                  const next = new Map(prev);

                  if (next.has(athlete.id)) {
                    next.delete(athlete.id);
                  } else {
                    next.set(athlete.id, athlete.fullName);
                  }

                  return next;
                })
              }
            />
            {selected.size > 0 ? (
              <p style={{ margin: 0 }}>
                <strong>{selected.size} selecionado(s):</strong> {[...selected.values()].join(', ')}
              </p>
            ) : null}
            <form className="form" onSubmit={(event) => void assign.submit(event)}>
              <ErrorSummary error={assign.error} />
              <div className="form-grid">
                <TextField
                  label="Começa a pagar em"
                  type="date"
                  required
                  value={form.startsOn}
                  onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                  hint="A primeira cobrança é a do mês desta data."
                />
                <TextField
                  label="Valor individual (opcional)"
                  maxLength={16}
                  numeric="decimal"
                  value={form.amountOverride}
                  onChange={(e) => setForm({ ...form, amountOverride: e.target.value })}
                  hint={`Vazio = valor do plano (${formatMoney(plan.amount.amount)}). Use para bolsa ou desconto.`}
                />
                <TextField
                  label="Motivo (opcional)"
                  maxLength={1000}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.replaceCurrent}
                  onChange={(e) => setForm({ ...form, replaceCurrent: e.target.checked })}
                />
                <span>
                  Se o atleta já estiver em outro plano, trocar para este (o anterior termina na
                  véspera da data acima)
                </span>
              </label>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={selected.size === 0 || assign.pending}
                >
                  <Icon name="check-lg" />{' '}
                  {assign.pending ? 'Adicionando…' : `Adicionar ${selected.size || ''} ao plano`}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {result ? (
          <Alert kind={result.skipped.length > 0 ? 'warning' : 'success'}>
            {result.assigned} atleta(s) adicionado(s).
            {result.skipped.length > 0 ? (
              <ul style={{ margin: '0.5rem 0 0' }}>
                {result.skipped.map((item) => (
                  <li key={item.athleteId}>
                    {item.fullName}: {item.reason}
                    {item.reason.includes('outro plano')
                      ? ' Marque “trocar para este” para mover.'
                      : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        {members.loading && !members.data ? <Skeleton lines={4} /> : null}
        {members.data && current.length === 0 ? (
          <Empty>Nenhum atleta neste plano ainda.</Empty>
        ) : null}
        {current.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Atleta</th>
                  <th scope="col">Status</th>
                  <th scope="col">Desde</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  {manage ? <th scope="col">Ação</th> : null}
                </tr>
              </thead>
              <tbody>
                {current.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Atleta">
                      <Link href={`/admin/atletas/${m.athlete.id}`}>{m.athlete.fullName}</Link>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`badge ${ATHLETE_STATUS[m.athlete.status as AthleteStatus]?.badge ?? ''}`}
                      >
                        {ATHLETE_STATUS[m.athlete.status as AthleteStatus]?.label ??
                          m.athlete.status}
                      </span>
                    </td>
                    <td data-label="Desde">{formatDate(m.startsOn)}</td>
                    <td data-label="Valor" className="num">
                      {formatMoney(m.effectiveAmount.amount)}
                      {m.amountOverride ? <small className="muted"> (individual)</small> : null}
                    </td>
                    {manage ? (
                      <td data-label="Ação">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEnding(m)}
                        >
                          <Icon name="person-dash" /> Tirar do plano
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {past.length > 0 ? (
        <details className="card">
          <summary>Já estiveram neste plano ({past.length})</summary>
          <ul>
            {past.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/atletas/${m.athlete.id}`}>{m.athlete.fullName}</Link> —{' '}
                {formatDate(m.startsOn)} a {formatDate(m.endsOn)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <ConfirmDialog
        open={ending !== null}
        title={`Tirar ${ending?.athlete.fullName ?? ''} do plano`}
        description="Meses depois da data de término não geram cobrança deste plano. Cobranças já geradas não mudam; cancele-as no detalhe da mensalidade, se for o caso."
        confirmLabel="Tirar do plano"
        requireReason
        onClose={() => setEnding(null)}
        onConfirm={async (reason) => {
          if (!ending) {
            return;
          }

          await api(`/athletes/${ending.athlete.id}/fee-plans/${ending.id}/end`, {
            method: 'POST',
            body: { endsOn, reason }
          });
          setNotice(`${ending.athlete.fullName} saiu do plano.`);
          await Promise.all([members.reload(), plans.reload()]);
        }}
      >
        <TextField
          label="Último dia no plano"
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
