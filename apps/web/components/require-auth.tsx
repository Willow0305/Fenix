'use client';

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
  const { status, can, sessionExpired } = useAuth();
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

  if (permissions.length > 0 && !can(...permissions)) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <Alert kind="warning">Você não tem permissão para acessar esta área.</Alert>
      </div>
    );
  }

  return <>{children}</>;
}
