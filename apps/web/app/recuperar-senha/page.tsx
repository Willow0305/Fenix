'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { BrandLogo } from '../components/brand-logo';
import { ApiError, apiRequest } from '../lib/api-client';
import styles from '../auth.module.scss';

export default function PasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiRequest<{ readonly message: string }>(
        '/auth/password-recovery',
        {
          method: 'POST',
          body: JSON.stringify({ email })
        },
        false
      );
      setMessage(response.message);
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

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="Recuperação segura">
        <Link className={styles.brand} href="/">
          <BrandLogo />
          Fênix Vôlei
        </Link>
        <div className={styles.brandCopy}>
          <h1>Recupere o acesso sem expor sua conta.</h1>
          <p>A resposta é sempre genérica e o código enviado é de uso único e temporário.</p>
        </div>
        <p className={styles.securityNote}>
          Nenhuma senha, código ou token é registrado nos logs de auditoria.
        </p>
      </section>

      <section className={styles.formPanel} aria-labelledby="recovery-title">
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>Segurança da conta</p>
          <h1 id="recovery-title">Recuperar senha</h1>
          <p className={styles.intro}>Informe o e-mail associado à conta.</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            {message ? (
              <div className={styles.success} role="status">
                {message}
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
            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? 'Solicitando…' : 'Solicitar código'}
            </button>
          </form>
          <nav className={styles.links} aria-label="Próximas etapas">
            <Link href="/redefinir-senha">Já tenho um código</Link>
            <Link href="/login">Voltar ao login</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
