'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';

import styles from '../auth.module.scss';
import { BrandLogo } from '../components/brand-logo';
import { ApiError, apiRequest } from '../lib/api-client';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await apiRequest<void>(
        '/auth/email-verification/confirm',
        {
          method: 'POST',
          body: JSON.stringify({ email, code })
        },
        false
      );
      setMessage('E-mail verificado. Você já pode entrar.');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível verificar o e-mail.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await apiRequest(
        '/auth/email-verification/resend',
        {
          method: 'POST',
          body: JSON.stringify({ email })
        },
        false
      );
      setMessage('Se a conta estiver disponível, uma nova verificação será enviada.');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível solicitar o reenvio.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.centerPage}>
      <section className={styles.messageCard} aria-labelledby="verification-title">
        <BrandLogo size="medium" />
        <p className={styles.eyebrow}>Confirmação da conta</p>
        <h1 id="verification-title">Verificar e-mail</h1>
        <p>Use o código de oito dígitos enviado para o endereço cadastrado.</p>
        <form className={styles.form} onSubmit={verify}>
          {error ? (
            <div className={styles.alert} role="alert">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className={styles.success} role="status">
              {message}
            </div>
          ) : null}
          <div className={styles.field}>
            <label htmlFor="verification-email">E-mail</label>
            <input
              autoComplete="email"
              id="verification-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="verification-code">Código</label>
            <input
              autoComplete="one-time-code"
              id="verification-code"
              inputMode="numeric"
              maxLength={8}
              minLength={8}
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </div>
          <button className={styles.button} disabled={submitting} type="submit">
            {submitting ? 'Validando…' : 'Verificar e-mail'}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={submitting || !email}
            onClick={resend}
            type="button"
          >
            Reenviar código
          </button>
        </form>
        <nav className={styles.links} aria-label="Navegação">
          <Link href="/login">Ir para o login</Link>
        </nav>
      </section>
    </main>
  );
}
