'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { useAuth } from '../lib/auth-context';
import { Alert, Loading } from './ui';

/**
 * Proteção de navegação. Melhora a experiência, mas a autorização real é sempre
 * verificada pela API (RN-AUT-004).
 */
export function RequireAuth({
  permissions = [],
  children
}: {
  readonly permissions?: readonly string[];
  readonly children: ReactNode;
}) {
  const { status, can, sessionExpired, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') {
      const reason = sessionExpired ? '&motivo=expirada' : '';

      router.replace(`/entrar?next=${encodeURIComponent(pathname)}${reason}`);
    }
  }, [status, router, pathname, sessionExpired]);

  if (status !== 'authenticated') {
    return <Loading label="Verificando sua sessão…" />;
  }

  if (
    permissions.length > 0 &&
    !can(...permissions) &&
    profile?.mfa.required &&
    !profile.mfa.verified
  ) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <Alert kind="warning">
          {profile.mfa.enabled
            ? 'Esta sessão não passou pela verificação em duas etapas. Saia e entre novamente.'
            : 'O painel exige verificação em duas etapas. Ative-a para continuar.'}
        </Alert>
        {profile.mfa.enabled ? null : (
          <p>
            <Link className="btn btn-primary" href="/minha-conta/seguranca">
              Ativar verificação em duas etapas
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (permissions.length > 0 && !can(...permissions)) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <Alert kind="warning">Você não tem permissão para acessar esta área.</Alert>
      </div>
    );
  }

  return <>{children}</>;
}
