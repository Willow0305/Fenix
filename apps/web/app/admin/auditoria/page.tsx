'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api-client';
import styles from '../admin.module.scss';

interface AuditRecord {
  readonly id: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly reason: string | null;
  readonly occurredAt: string;
  readonly actor: { readonly id: string; readonly name: string } | null;
  readonly requestId: string | null;
}

export default function AuditPage() {
  const [records, setRecords] = useState<readonly AuditRecord[]>([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selectedAction = '') => {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({ limit: '100' });

      if (selectedAction) {
        query.set('action', selectedAction);
      }

      const response = await apiRequest<{ readonly data: readonly AuditRecord[] }>(
        `/audit-logs?${query.toString()}`
      );
      setRecords(response.data);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível carregar a auditoria.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(action);
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Governança</p>
          <h1>Auditoria</h1>
          <p>Trilha imutável e minimizada das ações sensíveis de autenticação e administração.</p>
        </div>
      </header>

      <section className={styles.panel}>
        <form className={styles.formGrid} onSubmit={filter}>
          <label>
            Filtrar por ação
            <input
              maxLength={120}
              onChange={(event) => setAction(event.target.value.toUpperCase())}
              placeholder="Ex.: LOGIN_FAILED"
              value={action}
            />
          </label>
          <button className={styles.primaryButton} type="submit">
            Aplicar filtro
          </button>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="audit-list-title">
        <div className={styles.panelHeader}>
          <h2 id="audit-list-title">Eventos recentes</h2>
        </div>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
        {loading ? (
          <p className={styles.empty} aria-busy="true">
            Carregando trilha…
          </p>
        ) : records.length === 0 ? (
          <p className={styles.empty}>Nenhum evento corresponde ao filtro.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Ação</th>
                  <th>Ator</th>
                  <th>Entidade</th>
                  <th>Motivo / correlação</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'medium'
                      }).format(new Date(record.occurredAt))}
                    </td>
                    <td>
                      <span className={styles.badge}>{record.action}</span>
                    </td>
                    <td>{record.actor?.name ?? 'Sistema / não autenticado'}</td>
                    <td>
                      {record.entityType}
                      {record.entityId ? (
                        <>
                          <br />
                          <small>{record.entityId}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {record.reason ?? '—'}
                      {record.requestId ? (
                        <>
                          <br />
                          <small>{record.requestId}</small>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
