'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api-client';
import styles from '../admin.module.scss';

interface PrivacyRequest {
  readonly id: string;
  readonly protocol: string;
  readonly requesterEmail: string;
  readonly type: string;
  readonly status: string;
  readonly channel: string;
  readonly receivedAt: string;
}

export default function PrivacyPage() {
  const [requests, setRequests] = useState<readonly PrivacyRequest[]>([]);
  const [requesterEmail, setRequesterEmail] = useState('');
  const [type, setType] = useState('ACCESS');
  const [channel, setChannel] = useState('canal interno');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiRequest<{ readonly data: readonly PrivacyRequest[] }>(
        '/privacy/requests'
      );
      setRequests(response.data);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível carregar as solicitações.'
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const result = await apiRequest<{ readonly protocol: string }>('/privacy/requests', {
        method: 'POST',
        body: JSON.stringify({ requesterEmail, type, channel })
      });
      setNotice(`Solicitação registrada sob o protocolo ${result.protocol}.`);
      setRequesterEmail('');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível registrar a solicitação.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function simulateRetention() {
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const result = await apiRequest<{
        readonly candidates: Readonly<Record<string, number>>;
      }>('/privacy/retention-runs', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true })
      });
      setNotice(
        `Simulação concluída: ${Object.values(result.candidates).reduce(
          (total, value) => total + value,
          0
        )} registros candidatos.`
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível simular a retenção.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>LGPD e governança</p>
          <h1>Privacidade</h1>
          <p>Registre solicitações de titulares e valide a política de retenção em modo seguro.</p>
        </div>
      </header>

      <section className={styles.panel} aria-labelledby="privacy-create-title">
        <div className={styles.panelHeader}>
          <h2 id="privacy-create-title">Nova solicitação</h2>
        </div>
        <form className={styles.formGrid} onSubmit={create}>
          <label>
            E-mail do titular
            <input
              onChange={(event) => setRequesterEmail(event.target.value)}
              required
              type="email"
              value={requesterEmail}
            />
          </label>
          <label>
            Tipo
            <select onChange={(event) => setType(event.target.value)} value={type}>
              <option value="ACCESS">Acesso</option>
              <option value="CORRECTION">Correção</option>
              <option value="ANONYMIZATION">Anonimização</option>
              <option value="DELETION">Eliminação</option>
              <option value="PORTABILITY">Portabilidade</option>
              <option value="INFORMATION">Informação</option>
            </select>
          </label>
          <label>
            Canal
            <input
              maxLength={80}
              onChange={(event) => setChannel(event.target.value)}
              required
              value={channel}
            />
          </label>
          <button className={styles.primaryButton} disabled={submitting} type="submit">
            Registrar
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Solicitações registradas</h2>
          <button
            className={styles.primaryButton}
            disabled={submitting}
            onClick={simulateRetention}
            type="button"
          >
            Simular retenção
          </button>
        </div>
        {notice ? (
          <div className={styles.notice} role="status">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Titular</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Recebida em</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item.id}>
                  <td>{item.protocol}</td>
                  <td>{item.requesterEmail}</td>
                  <td>{item.type}</td>
                  <td>{item.status}</td>
                  <td>{new Intl.DateTimeFormat('pt-BR').format(new Date(item.receivedAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
