'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, errorMessage } from '../lib/api-client';
import type { MfaSetup, MfaStatus } from '../lib/api-types';
import { useAuth } from '../lib/auth-context';
import { Alert, ErrorSummary, Loading, TextField, useSubmit } from './ui';

function saveCodes(codes: readonly string[]): void {
  const text = [
    'Fênix Vôlei — códigos de recuperação da verificação em duas etapas',
    'Cada código funciona uma única vez. Guarde em local seguro.',
    '',
    ...codes
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = 'fenix-codigos-de-recuperacao.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function RecoveryCodes({
  codes,
  onDone
}: {
  readonly codes: readonly string[];
  readonly onDone: () => void;
}) {
  return (
    <div className="stack">
      <Alert kind="warning">
        Guarde estes códigos agora: eles não serão mostrados de novo. Cada um permite entrar uma
        única vez se você perder o celular.
      </Alert>
      <ul className="mfa-codes">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => saveCodes(codes)}>
          Baixar códigos (.txt)
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Já guardei os códigos
        </button>
      </div>
    </div>
  );
}

/** Ativação e gestão da verificação em duas etapas (DT-037). */
export function MfaSection() {
  const { reloadProfile } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'idle' | 'regenerate' | 'disable'>('idle');

  const load = useCallback(async () => {
    try {
      setStatus(await api<MfaStatus>('/me/mfa'));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setPassword('');
    setCode('');
    setMode('idle');
  };

  const begin = useSubmit(async () => {
    setSetup(await api<MfaSetup>('/me/mfa/setup', { method: 'POST', body: { password } }));
    setPassword('');
  });
  const confirm = useSubmit(async () => {
    const result = await api<{ recoveryCodes: string[] }>('/me/mfa/enable', {
      method: 'POST',
      body: { code }
    });

    setCode('');
    setSetup(null);
    setCodes(result.recoveryCodes);
  });
  const regenerate = useSubmit(async () => {
    const result = await api<{ recoveryCodes: string[] }>('/me/mfa/recovery-codes', {
      method: 'POST',
      body: { password, code }
    });

    reset();
    setCodes(result.recoveryCodes);
  });
  const disable = useSubmit(async () => {
    await api('/me/mfa/disable', { method: 'POST', body: { password, code } });
    reset();
    await load();
    await reloadProfile();
  });

  const finish = () => {
    setCodes(null);
    void load();
    void reloadProfile();
  };

  return (
    <section className="card stack" aria-labelledby="duas-etapas">
      <h2 id="duas-etapas">Verificação em duas etapas</h2>
      {loadError ? <Alert kind="error">{loadError}</Alert> : null}
      {status === null && !loadError ? <Loading /> : null}

      {codes !== null ? <RecoveryCodes codes={codes} onDone={finish} /> : null}

      {codes === null && status !== null && !status.enabled ? (
        <>
          <p>
            Além da senha, o login pede um código de 6 dígitos gerado no seu celular por um
            aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy ou
            similar).
            {status.required ? <strong> Obrigatório para acessar o painel.</strong> : null}
          </p>

          {setup === null ? (
            <form className="form" onSubmit={(event) => void begin.submit(event)}>
              <ErrorSummary error={begin.error} />
              <TextField
                label="Confirme sua senha"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={begin.fieldError('password')}
              />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={begin.pending}>
                  Começar ativação
                </button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={(event) => void confirm.submit(event)}>
              <ol className="stack">
                <li>Abra o aplicativo autenticador e leia o QR code:</li>
              </ol>
              {/* SVG como imagem: o navegador não executa scripts dentro de <img>. */}
              <img
                className="mfa-qr"
                src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`}
                alt="QR code para configurar o aplicativo autenticador"
                width={200}
                height={200}
              />
              <p className="muted">
                Não consegue ler? Digite a chave manualmente: <code>{setup.secret}</code>
              </p>
              <ErrorSummary error={confirm.error} />
              <TextField
                label="Código de 6 dígitos mostrado no aplicativo"
                maxLength={6}
                numeric="integer"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={confirm.fieldError('code')}
              />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={confirm.pending}>
                  Ativar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSetup(null);
                    setCode('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      ) : null}

      {codes === null && status?.enabled ? (
        <>
          <p>
            <span className="badge badge-success">Ativa</span> Códigos de recuperação restantes:{' '}
            <strong>{status.recoveryCodesRemaining}</strong>
          </p>
          {status.recoveryCodesRemaining <= 3 ? (
            <Alert kind="warning">Restam poucos códigos de recuperação. Gere novos.</Alert>
          ) : null}

          {mode === 'idle' ? (
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode('regenerate')}
              >
                Gerar novos códigos de recuperação
              </button>
              {status.required ? null : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMode('disable')}
                >
                  Desativar
                </button>
              )}
            </div>
          ) : (
            <form
              className="form"
              onSubmit={(event) =>
                void (mode === 'regenerate' ? regenerate : disable).submit(event)
              }
            >
              <p>
                {mode === 'regenerate'
                  ? 'Os códigos antigos deixarão de funcionar.'
                  : 'O login voltará a pedir somente a senha.'}
              </p>
              <ErrorSummary error={(mode === 'regenerate' ? regenerate : disable).error} />
              <TextField
                label="Senha"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <TextField
                label="Código do aplicativo"
                maxLength={20}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {mode === 'regenerate' ? 'Gerar códigos' : 'Desativar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      ) : null}
    </section>
  );
}
