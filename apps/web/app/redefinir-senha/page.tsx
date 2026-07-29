'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { BrandLogo } from '../components/brand-logo';
import { ApiError, apiRequest } from '../lib/api-client';
import styles from '../auth.module.scss';

export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmation) {
      setError('A confirmação deve ser igual à nova senha.');
      return;
    }

    setSubmitting(true);

    try {
      await apiRequest<void>(
        '/auth/password-reset',
        {
          method: 'POST',
          body: JSON.stringify({ email, code, newPassword })
        },
        false
      );
      setMessage('Senha redefinida. Todas as sessões anteriores foram revogadas.');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível redefinir a senha.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="Nova senha">
        <Link className={styles.brand} href="/">
          <BrandLogo />
          Fênix Vôlei
        </Link>
        <div className={styles.brandCopy}>
          <h1>Defina uma nova credencial.</h1>
          <p>O código é validado uma única vez e as sessões anteriores são encerradas.</p>
        </div>
        <p className={styles.securityNote}>A senha deve possuir ao menos oito caracteres.</p>
      </section>

      <section className={styles.formPanel} aria-labelledby="reset-title">
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>Código de uso único</p>
          <h1 id="reset-title">Redefinir senha</h1>
          <form className={styles.form} onSubmit={handleSubmit}>
            {message ? (
              <div className={styles.success} role="status">
                {message} <Link href="/login">Entrar agora.</Link>
              </div>
            ) : null}
            {error ? (
              <div className={styles.alert} role="alert">
                {error}
              </div>
            ) : null}
            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="code">Código recebido</label>
              <input
                autoComplete="one-time-code"
                id="code"
                inputMode="numeric"
                maxLength={8}
                minLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/gu, ''))}
                pattern="\d{6,8}"
                required
                value={code}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="new-password">Nova senha</label>
              <input
                autoComplete="new-password"
                id="new-password"
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="confirmation">Confirmar nova senha</label>
              <input
                autoComplete="new-password"
                id="confirmation"
                minLength={8}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </div>
            <button
              className={styles.button}
              disabled={submitting || Boolean(message)}
              type="submit"
            >
              {submitting ? 'Redefinindo…' : 'Redefinir senha'}
            </button>
          </form>
          <nav className={styles.links}>
            <Link href="/recuperar-senha">Solicitar outro código</Link>
            <Link href="/login">Voltar ao login</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
