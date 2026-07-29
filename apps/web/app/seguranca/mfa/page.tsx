'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import styles from '../../auth.module.scss';
import { BrandLogo } from '../../components/brand-logo';
import { ApiError, apiRequest, type SessionResponse } from '../../lib/api-client';

interface EnrollmentResponse {
  readonly secret: string;
  readonly otpAuthUri: string;
  readonly qrCodeDataUrl: string;
}

interface ConfirmationResponse {
  readonly recoveryCodes: readonly string[];
}

export default function MfaEnrollmentPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse>();
  const [enrollment, setEnrollment] = useState<EnrollmentResponse>();
  const [recoveryCodes, setRecoveryCodes] = useState<readonly string[]>([]);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<SessionResponse>('/auth/me')
      .then(setSession)
      .catch(() => router.replace('/login'));
  }, [router]);

  async function beginEnrollment() {
    setError('');
    setSubmitting(true);

    try {
      setEnrollment(
        await apiRequest<EnrollmentResponse>('/auth/mfa/enrollment', {
          method: 'POST'
        })
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível iniciar a configuração.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await apiRequest<ConfirmationResponse>('/auth/mfa/enrollment/confirm', {
        method: 'POST',
        body: JSON.stringify({ code })
      });

      setRecoveryCodes(result.recoveryCodes);
      setEnrollment(undefined);
      setSession((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                mfaEnabled: true,
                mfaEnrollmentRequired: false,
                mfaVerified: true
              }
            }
          : current
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível confirmar o MFA.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await apiRequest<void>('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password, code })
      });
      router.replace('/login');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível desativar o MFA.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isMandatory = session?.user.mfaEnrollmentRequired;

  return (
    <main className={styles.centerPage}>
      <section className={styles.messageCard} aria-labelledby="mfa-setup-title">
        <BrandLogo size="medium" />
        <p className={styles.eyebrow}>Segurança da conta</p>
        <h1 id="mfa-setup-title">Autenticação em dois fatores</h1>
        <p>
          {isMandatory
            ? 'Seu perfil exige MFA. Configure-o antes de acessar funções administrativas.'
            : 'Use um aplicativo autenticador compatível com TOTP.'}
        </p>

        {error ? (
          <div className={styles.alert} role="alert">
            {error}
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className={styles.recoveryPanel} role="status">
            <h2>Salve os códigos de recuperação</h2>
            <p>Eles aparecem somente agora e cada código funciona uma única vez.</p>
            <ul className={styles.codeList}>
              {recoveryCodes.map((recoveryCode) => (
                <li key={recoveryCode}>{recoveryCode}</li>
              ))}
            </ul>
            <Link href="/admin">Concluí e salvei os códigos</Link>
          </div>
        ) : enrollment ? (
          <>
            <Image
              alt="QR Code para configurar o aplicativo autenticador"
              className={styles.qrCode}
              height={256}
              src={enrollment.qrCodeDataUrl}
              unoptimized
              width={256}
            />
            <div className={styles.secretBox}>
              <span>Chave manual</span>
              <code>{enrollment.secret}</code>
            </div>
            <form className={styles.form} onSubmit={confirm}>
              <div className={styles.field}>
                <label htmlFor="setup-code">Código exibido no aplicativo</label>
                <input
                  autoComplete="one-time-code"
                  id="setup-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  value={code}
                />
              </div>
              <button className={styles.button} disabled={submitting} type="submit">
                Confirmar e ativar
              </button>
            </form>
          </>
        ) : session?.user.mfaEnabled ? (
          <form className={styles.form} onSubmit={disable}>
            <p>O MFA está ativo. A desativação exige senha e segundo fator.</p>
            <div className={styles.field}>
              <label htmlFor="disable-password">Senha atual</label>
              <input
                autoComplete="current-password"
                id="disable-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="disable-code">Código MFA</label>
              <input
                autoComplete="one-time-code"
                id="disable-code"
                onChange={(event) => setCode(event.target.value)}
                required
                value={code}
              />
            </div>
            <button className={styles.secondaryButton} disabled={submitting} type="submit">
              Desativar MFA
            </button>
          </form>
        ) : (
          <button
            className={styles.button}
            disabled={submitting || !session}
            onClick={beginEnrollment}
            type="button"
          >
            Configurar aplicativo autenticador
          </button>
        )}
      </section>
    </main>
  );
}
