'use client';

import { useState } from 'react';

import { Alert, Empty, Loading, PageHeader, Pagination } from '../../../components/ui';
import type { AuditLog, Page } from '../../../lib/api-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', entityType: '' });
  const [applied, setApplied] = useState(filters);
  const logs = useResource<Page<AuditLog>>('/audit-logs', { page, pageSize: 25, ...applied });

  return (
    <>
      <PageHeader title="Auditoria" description="Trilha imutável de ações sensíveis." />
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setApplied(filters);
        }}
      >
        <label className="field">
          <span className="label">Ação começa com</span>
          <input
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            placeholder="ex.: user."
          />
        </label>
        <label className="field">
          <span className="label">Entidade</span>
          <input
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            placeholder="ex.: User"
          />
        </label>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
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
                <th scope="col">Motivo / detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.data.map((log) => (
                <tr key={log.id}>
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
                  <td>
                    {log.reason ? <p style={{ margin: 0 }}>{log.reason}</p> : null}
                    {log.before || log.after || log.metadata ? (
                      <details>
                        <summary>Valores</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                          {JSON.stringify(
                            { antes: log.before, depois: log.after, meta: log.metadata },
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {logs.data ? <Pagination {...logs.data.meta} onChange={setPage} /> : null}
    </>
  );
}
