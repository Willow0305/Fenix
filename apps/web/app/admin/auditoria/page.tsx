'use client';

import { Fragment, useState } from 'react';

import { Alert, Empty, Loading, PageHeader, Pagination } from '../../../components/ui';
import type { AuditLog, Page } from '../../../lib/api-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

type Filters = {
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  requestId: string;
  from: string;
  to: string;
};

const EMPTY: Filters = {
  action: '',
  entityType: '',
  entityId: '',
  actorUserId: '',
  requestId: '',
  from: '',
  to: ''
};

const UUID = /^[0-9a-f-]{36}$/i;

/** Mantém somente filtros válidos (identificadores precisam ser UUID completos). */
function clean(filters: Filters): Partial<Filters> {
  return Object.fromEntries(
    Object.entries(filters).filter(([key, value]) =>
      ['entityId', 'actorUserId', 'requestId'].includes(key) ? UUID.test(value) : value !== ''
    )
  );
}

function AuditDetail({ id }: { readonly id: string }) {
  const detail = useResource<AuditLog & { related: AuditLog[] }>(`/audit-logs/${id}`);

  if (detail.loading && !detail.data) {
    return <Loading />;
  }

  if (detail.error || !detail.data) {
    return <Alert kind="error">{detail.error ?? 'Registro não encontrado.'}</Alert>;
  }

  const d = detail.data;

  return (
    <div className="stack">
      <dl className="form-grid">
        <div>
          <dt className="muted">Entidade</dt>
          <dd>
            {d.entityType} <code>{d.entityId ?? '—'}</code>
          </dd>
        </div>
        <div>
          <dt className="muted">Requisição</dt>
          <dd>
            <code>{d.requestId ?? '—'}</code>
          </dd>
        </div>
      </dl>
      <div className="form-grid">
        <div>
          <strong>Antes</strong>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(d.before, null, 2) ?? '—'}
          </pre>
        </div>
        <div>
          <strong>Depois</strong>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(d.after, null, 2) ?? '—'}
          </pre>
        </div>
      </div>
      {d.metadata ? (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {JSON.stringify(d.metadata, null, 2)}
        </pre>
      ) : null}
      {d.related.length > 0 ? (
        <div>
          <strong>Outras ações da mesma requisição</strong>
          <ul>
            {d.related.map((r) => (
              <li key={r.id}>
                <code>{r.action}</code> · {r.entityType} · {formatDateTime(r.occurredAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Partial<Filters>>({});
  const [open, setOpen] = useState<string | null>(null);
  const logs = useResource<Page<AuditLog>>('/audit-logs', { page, pageSize: 25, ...applied });
  const types = useResource<string[]>('/audit-logs/entity-types');
  const set = (key: keyof Filters) => (event: { target: { value: string } }) =>
    setFilters({ ...filters, [key]: event.target.value });

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Trilha imutável de ações sensíveis. Datas no fuso do time; identificadores aceitam o UUID completo."
      />
      <form
        className="card form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setOpen(null);
          setApplied(clean(filters));
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span className="label">Ação começa com</span>
            <input value={filters.action} onChange={set('action')} placeholder="ex.: finance." />
          </label>
          <label className="field">
            <span className="label">Entidade</span>
            <select value={filters.entityType} onChange={set('entityType')}>
              <option value="">Todas</option>
              {(types.data ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">De</span>
            <input type="date" value={filters.from} onChange={set('from')} />
          </label>
          <label className="field">
            <span className="label">Até</span>
            <input type="date" value={filters.to} onChange={set('to')} />
          </label>
          <label className="field">
            <span className="label">ID da entidade</span>
            <input value={filters.entityId} onChange={set('entityId')} />
          </label>
          <label className="field">
            <span className="label">ID de quem agiu</span>
            <input value={filters.actorUserId} onChange={set('actorUserId')} />
          </label>
          <label className="field">
            <span className="label">ID da requisição</span>
            <input value={filters.requestId} onChange={set('requestId')} />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary">
            Filtrar
          </button>
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              setFilters(EMPTY);
              setApplied({});
              setPage(1);
            }}
          >
            Limpar
          </button>
        </div>
      </form>
      {logs.error ? <Alert kind="error">{logs.error}</Alert> : null}
      {logs.loading && !logs.data ? <Loading /> : null}
      {logs.data?.data.length === 0 ? <Empty>Nenhum registro para os filtros.</Empty> : null}
      {logs.data && logs.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Quem</th>
                <th scope="col">Ação</th>
                <th scope="col">Entidade</th>
                <th scope="col">Motivo</th>
                <th scope="col">
                  <span className="visually-hidden">Detalhe</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.data.data.map((log) => (
                <Fragment key={log.id}>
                  <tr>
                    <td>{formatDateTime(log.occurredAt)}</td>
                    <td>{log.actor?.name ?? 'Sistema/anônimo'}</td>
                    <td>
                      <code>{log.action}</code>
                    </td>
                    <td>
                      {log.entityType}
                      {log.entityId ? (
                        <small className="muted"> {log.entityId.slice(0, 8)}</small>
                      ) : null}
                    </td>
                    <td>{log.reason ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link"
                        aria-expanded={open === log.id}
                        onClick={() => setOpen(open === log.id ? null : log.id)}
                      >
                        {open === log.id ? 'Fechar' : 'Detalhes'}
                      </button>
                    </td>
                  </tr>
                  {open === log.id ? (
                    <tr>
                      <td colSpan={6}>
                        <AuditDetail id={log.id} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {logs.data ? <Pagination {...logs.data.meta} onChange={setPage} /> : null}
    </>
  );
}
