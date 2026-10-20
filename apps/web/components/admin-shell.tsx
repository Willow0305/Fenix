'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { useAuth } from '../lib/auth-context';
import styles from './admin-shell.module.scss';
import { BrandLogo } from './brand-logo';

export interface AdminLink {
  readonly href: string;
  readonly label: string;
  readonly permission: string;
}

export interface AdminGroup {
  readonly label: string;
  readonly links: readonly AdminLink[];
}

/** Navegação agrupada (11-UX-UI.md). Só exibe o que o usuário pode acessar. */
export const ADMIN_NAV: readonly AdminGroup[] = [
  {
    label: 'Visão geral',
    links: [{ href: '/admin', label: 'Painel', permission: 'dashboard.read' }]
  },
  {
    label: 'Pessoas',
    links: [
      { href: '/admin/atletas', label: 'Atletas', permission: 'athletes.read' },
      { href: '/admin/interessados', label: 'Interessados', permission: 'registrations.read' },
      { href: '/admin/seletivas', label: 'Seletivas', permission: 'registrations.read' },
      { href: '/admin/equipes', label: 'Equipes e categorias', permission: 'athletes.read' }
    ]
  },
  {
    label: 'Financeiro',
    links: [
      { href: '/admin/mensalidades', label: 'Mensalidades', permission: 'fees.read' },
      { href: '/admin/planos', label: 'Planos', permission: 'fees.read' },
      { href: '/admin/caixa', label: 'Caixa Fênix', permission: 'finance.read' },
      { href: '/admin/caixa/obrigacoes', label: 'Pagar e receber', permission: 'finance.read' },
      { href: '/admin/caixa/fechamentos', label: 'Fechamentos', permission: 'finance.read' },
      { href: '/admin/caixa/cadastros', label: 'Contas e categorias', permission: 'finance.read' }
    ]
  },
  {
    label: 'Loja',
    links: [
      { href: '/admin/produtos', label: 'Produtos', permission: 'products.manage' },
      { href: '/admin/pedidos', label: 'Pedidos', permission: 'orders.read' },
      { href: '/admin/remessas', label: 'Remessas', permission: 'campaigns.manage' }
    ]
  },
  {
    label: 'Parceiros',
    links: [
      { href: '/admin/parceiros', label: 'Parceiros', permission: 'partners.manage' },
      { href: '/admin/servicos', label: 'Profissionais e serviços', permission: 'services.manage' },
      { href: '/admin/agendamentos', label: 'Agendamentos', permission: 'appointments.manage' },
      { href: '/admin/repasses', label: 'Repasses', permission: 'settlements.manage' }
    ]
  },
  {
    label: 'Comunicação',
    links: [
      { href: '/admin/noticias', label: 'Notícias', permission: 'news.manage' },
      { href: '/admin/eventos', label: 'Eventos e partidas', permission: 'events.manage' },
      { href: '/admin/forum', label: 'Fórum e moderação', permission: 'forum.moderate' },
      { href: '/admin/notificacoes', label: 'Notificações', permission: 'notifications.send' }
    ]
  },
  {
    label: 'Governança',
    links: [
      { href: '/admin/relatorios', label: 'Relatórios', permission: 'reports.read' },
      { href: '/admin/usuarios', label: 'Usuários', permission: 'users.read' },
      { href: '/admin/papeis', label: 'Papéis e permissões', permission: 'users.read' },
      { href: '/admin/configuracoes', label: 'Configurações', permission: 'dashboard.read' },
      { href: '/admin/auditoria', label: 'Auditoria', permission: 'audit.read' },
      {
        href: '/admin/privacidade',
        label: 'Privacidade (LGPD)',
        permission: 'privacy.requests.manage'
      }
    ]
  }
];

export function AdminShell({ children }: { readonly children: ReactNode }) {
  const { profile, can, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${open ? styles.open : ''}`}
        aria-label="Navegação administrativa"
      >
        <Link href="/" className={styles.brand}>
          <BrandLogo size={36} />
          <span>Fênix · Painel</span>
        </Link>
        <nav>
          {ADMIN_NAV.map((group) => {
            const links = group.links.filter((link) => can(link.permission));

            if (links.length === 0) {
              return null;
            }

            return (
              <div key={group.label} className={styles.group}>
                <span className={styles.groupLabel}>{group.label}</span>
                <ul>
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={pathname === link.href ? 'page' : undefined}
                        onClick={() => setOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${styles.menu}`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
          <span className="spacer" />
          <Link href="/minha-conta">{profile?.name}</Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void logout()}>
            Sair
          </button>
        </header>
        <main id="conteudo" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
