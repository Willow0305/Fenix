'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { BrandLogo } from '../components/brand-logo';
import { ApiError, apiRequest, type LoginResponse } from '../lib/api-client';
import styles from '../auth.module.scss';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const session = await apiRequest<LoginResponse>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password })
        },
        false
      );

      if (session.status === 'MFA_REQUIRED') {
        sessionStorage.setItem('fenix_mfa_challenge', session.challengeToken);
        router.replace('/desafio-mfa');
        return;
      }

      if (session.user.mfaEnrollmentRequired) {
        router.replace('/seguranca/mfa');
        return;
      }

      const hasAdministrativeAccess = session.user.permissions.some((permission) =>
        ['users.read', 'permissions.manage', 'audit.read'].includes(permission)
      );

      router.replace(hasAdministrativeAccess ? '/admin' : '/acesso-negado');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível entrar. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="Fênix Vôlei">
        <Link className={styles.brand} href="/">
          <BrandLogo />
          Fênix Vôlei
        </Link>
        <div className={styles.brandCopy}>
          <h1>Gestão organizada. Acesso protegido.</h1>
          <p>
            Ambiente administrativo mínimo da Fase 1, com permissões granulares e trilha de
            auditoria.
          </p>
        </div>
        <p className={styles.securityNote}>
          Use apenas dados fictícios. A produção permanece bloqueada pelos gates de segurança, LGPD
          e governança.
        </p>
      </section>

      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>Área restrita</p>
          <h1 id="login-title">Entrar</h1>
          <p className={styles.intro}>Informe suas credenciais para acessar o painel autorizado.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
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
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <input
                autoComplete="current-password"
                id="password"
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? 'Validando…' : 'Entrar com segurança'}
            </button>
          </form>

          <nav className={styles.links} aria-label="Ajuda de acesso">
            <Link href="/recuperar-senha">Esqueci minha senha</Link>
            <Link href="/verificar-email">Verificar e-mail</Link>
            <Link href="/">Voltar ao início</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
