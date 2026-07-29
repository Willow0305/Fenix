'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import styles from '../auth.module.scss';
import { BrandLogo } from '../components/brand-logo';
import { ApiError, apiRequest, type SessionResponse } from '../lib/api-client';

export default function MfaChallengePage() {
  const router = useRouter();
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('fenix_mfa_challenge');

    if (!stored) {
      setError('O desafio não está disponível. Entre novamente.');
      return;
    }

    setChallengeToken(stored);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const session = await apiRequest<SessionResponse>(
        '/auth/mfa/challenge',
        {
          method: 'POST',
          body: JSON.stringify({ challengeToken, code })
        },
        false
      );

      sessionStorage.removeItem('fenix_mfa_challenge');
      const hasAdministrativeAccess = session.user.permissions.some((permission) =>
        ['users.read', 'permissions.manage', 'audit.read'].includes(permission)
      );

      router.replace(hasAdministrativeAccess ? '/admin' : '/acesso-negado');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível validar o segundo fator.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.centerPage}>
      <section className={styles.messageCard} aria-labelledby="mfa-title">
        <BrandLogo size="medium" />
        <p className={styles.eyebrow}>Segundo fator</p>
        <h1 id="mfa-title">Confirme o acesso</h1>
        <p>Informe o código do aplicativo autenticador ou um código de recuperação.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? (
            <div className={styles.alert} role="alert">
              {error}
            </div>
          ) : null}
          <div className={styles.field}>
            <label htmlFor="mfa-code">Código MFA</label>
            <input
              autoComplete="one-time-code"
              id="mfa-code"
              maxLength={24}
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </div>
          <button className={styles.button} disabled={submitting || !challengeToken} type="submit">
            {submitting ? 'Validando…' : 'Confirmar segundo fator'}
          </button>
        </form>
        <nav className={styles.links} aria-label="Ajuda">
          <Link href="/login">Voltar ao login</Link>
        </nav>
      </section>
    </main>
  );
}
