'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '../components/brand-logo';
import { ApiError, apiRequest, type SessionResponse, type SessionUser } from '../lib/api-client';
import styles from './admin.module.scss';
import { createFinanceNavigation } from './finance-navigation';
import { createSportsNavigation } from './sports-navigation';

const AdminSessionContext = createContext<SessionUser | undefined>(undefined);

export function useAdminSession(): SessionUser {
  const session = useContext(AdminSessionContext);

  if (!session) {
    throw new Error('Admin session is not available.');
  }

  return session;
}

interface AdminShellProps {
  readonly children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiRequest<SessionResponse>('/auth/me')
      .then((session) => {
        const hasAdministrativeAccess = session.user.permissions.some((permission) =>
          [
            'users.read',
            'permissions.manage',
            'audit.read',
            'sports.read',
            'finance.read'
          ].includes(permission)
        );

        if (!hasAdministrativeAccess) {
          router.replace('/acesso-negado');
          return;
        }

        if (active) {
          setUser(session.user);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.problem.status === 403) {
          router.replace('/acesso-negado');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  const navigation = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      { href: '/admin', label: 'Visão geral', visible: true },
      {
        href: '/admin/usuarios',
        label: 'Usuários',
        visible: user.permissions.includes('users.read')
      },
      {
        href: '/admin/perfis',
        label: 'Perfis',
        visible:
          user.permissions.includes('users.read') || user.permissions.includes('permissions.manage')
      },
      {
        href: '/admin/auditoria',
        label: 'Auditoria',
        visible: user.permissions.includes('audit.read')
      },
      {
        href: '/admin/privacidade',
        label: 'Privacidade',
        visible: user.permissions.includes('privacy.requests.manage')
      },
      ...createSportsNavigation(user.permissions),
      ...createFinanceNavigation(user.permissions),
      {
        href: '/seguranca/mfa',
        label: 'Segurança',
        visible: true
      }
    ].filter(({ visible }) => visible);
  }, [user]);

  async function logout() {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' }, false);
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  if (loading || !user) {
    return (
      <main className={styles.loading} aria-busy="true">
        Validando acesso administrativo…
      </main>
    );
  }

  return (
    <AdminSessionContext.Provider value={user}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <Link className={styles.brand} href="/admin">
            <BrandLogo />
            Fênix Admin
          </Link>
          <p className={styles.scope}>Governança · Fases 1–3</p>
          <nav className={styles.nav} aria-label="Administração">
            {navigation.map((item) => (
              <Link
                className={
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
                    ? styles.active
                    : undefined
                }
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={styles.profile}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <button onClick={logout} type="button">
              Sair e revogar sessão
            </button>
          </div>
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </AdminSessionContext.Provider>
  );
}
