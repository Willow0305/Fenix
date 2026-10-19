'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireAuth } from '../../../components/require-auth';
import { useAuth } from '../../../lib/auth-context';

interface AccountLink {
  readonly href: string;
  readonly label: string;
  readonly athleteOnly?: boolean;
}

const ACCOUNT_LINKS: readonly AccountLink[] = [
  { href: '/minha-conta', label: 'Visão geral' },
  { href: '/minha-conta/atleta', label: 'Meus dados de atleta', athleteOnly: true },
  { href: '/minha-conta/mensalidades', label: 'Mensalidades', athleteOnly: true },
  { href: '/minha-conta/inscricoes', label: 'Inscrições' },
  { href: '/minha-conta/pedidos', label: 'Pedidos' },
  { href: '/minha-conta/favoritos', label: 'Favoritos' },
  { href: '/minha-conta/agendamentos', label: 'Agendamentos' },
  { href: '/minha-conta/notificacoes', label: 'Notificações' },
  { href: '/minha-conta/seguranca', label: 'Segurança' }
];

function AccountNav() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const isAthlete = profile?.athleteId !== null && profile?.athleteId !== undefined;

  return (
    <nav aria-label="Minha conta" className="card stack" style={{ alignSelf: 'start' }}>
      <strong>{profile?.name}</strong>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.25rem' }}>
        {ACCOUNT_LINKS.filter((link) => !link.athleteOnly || isAthlete).map((link) => (
          <li key={link.href}>
            <Link href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void logout()}>
        Sair
      </button>
    </nav>
  );
}

export default function AccountLayout({ children }: { readonly children: ReactNode }) {
  return (
    <RequireAuth>
      <div
        className="container"
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          paddingTop: '2rem'
        }}
      >
        <AccountNav />
        <div style={{ gridColumn: 'span 3', minWidth: 0 }} className="stack">
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
