'use client';

import { useCallback, useEffect, useState } from 'react';

import { MfaSection } from '../../../../components/mfa-section';
import { TrustedDevicesSection } from '../../../../components/trusted-devices-section';
import {
  Alert,
  ErrorSummary,
  Loading,
  PageHeader,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api-client';
import type { SessionInfo } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import { formatDateTime } from '../../../../lib/format';

export default function SecurityPage() {
  const { profile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await api<SessionInfo[]>('/me/sessions'));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useSubmit(async () => {
    await api('/me/password', {
      method: 'POST',
      body: { currentPassword: current, newPassword: next }
    });
    setCurrent('');
    setNext('');
    change.setMessage('Senha alterada. As demais sessões foram encerradas.');
    await load();
  });

  async function revoke(id: string) {
    await api(`/me/sessions/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <>
      <PageHeader title="Segurança" />
      <MfaSection />
      {profile?.mfa.enabled ? <TrustedDevicesSection /> : null}
      <form className="form card" onSubmit={(event) => void change.submit(event)}>
        <h2>Alterar senha</h2>
        {change.message ? <Alert kind="success">{change.message}</Alert> : null}
        <ErrorSummary error={change.error} />
        <TextField
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={change.fieldError('currentPassword')}
        />
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint="Mínimo de 10 caracteres, com letras e números."
          error={change.fieldError('password')}
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={change.pending}>
            Alterar senha
          </button>
        </div>
      </form>

      <section className="card stack" aria-labelledby="sessoes">
        <h2 id="sessoes">Sessões ativas</h2>
        {loadError ? <Alert kind="error">{loadError}</Alert> : null}
        {sessions === null && !loadError ? <Loading /> : null}
        {sessions?.map((session) => (
          <div key={session.id} className="row">
            <span>
              Iniciada em {formatDateTime(session.createdAt)} · expira em{' '}
              {formatDateTime(session.expiresAt)}
            </span>
            {session.current ? (
              <span className="badge badge-success">Esta sessão</span>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void revoke(session.id)}
              >
                Encerrar
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
