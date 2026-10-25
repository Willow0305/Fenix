'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { useAuth } from '../lib/auth-context';
import styles from './admin-shell.module.scss';
import { BrandLogo } from './brand-logo';
import { Icon } from './icon';

export interface AdminLink {
  readonly href: string;
  readonly label: string;
  readonly permission: string;
  /** Nome do ícone do Bootstrap Icons (docs/29 §3.11). */
  readonly icon: string;
}

export interface AdminGroup {
  readonly label: string;
  readonly links: readonly AdminLink[];
}

/** Navegação agrupada (11-UX-UI.md). Só exibe o que o usuário pode acessar. */
export const ADMIN_NAV: readonly AdminGroup[] = [
  {
    label: 'Visão geral',
    links: [{ href: '/admin', icon: 'speedometer2', label: 'Painel', permission: 'dashboard.read' }]
  },
  {
    label: 'Pessoas',
    links: [
      {
        href: '/admin/atletas',
        icon: 'person-badge',
        label: 'Atletas',
        permission: 'athletes.read'
      },
      {
        href: '/admin/interessados',
        icon: 'person-raised-hand',
        label: 'Interessados',
        permission: 'registrations.read'
      },
      {
        href: '/admin/seletivas',
        icon: 'clipboard-check',
        label: 'Seletivas',
        permission: 'registrations.read'
      },
      {
        href: '/admin/equipes',
        icon: 'people',
        label: 'Equipes e categorias',
        permission: 'athletes.read'
      }
    ]
  },
  {
    label: 'Financeiro',
    links: [
      {
        href: '/admin/mensalidades',
        icon: 'calendar2-check',
        label: 'Mensalidades',
        permission: 'fees.read'
      },
      { href: '/admin/planos', icon: 'card-list', label: 'Planos', permission: 'fees.read' },
      { href: '/admin/caixa', icon: 'cash-coin', label: 'Caixa Fênix', permission: 'finance.read' },
      {
        href: '/admin/caixa/obrigacoes',
        icon: 'arrow-left-right',
        label: 'Pagar e receber',
        permission: 'finance.read'
      },
      {
        href: '/admin/caixa/fechamentos',
        icon: 'journal-check',
        label: 'Fechamentos',
        permission: 'finance.read'
      },
      {
        href: '/admin/caixa/cadastros',
        icon: 'bank',
        label: 'Contas e categorias',
        permission: 'finance.read'
      }
    ]
  },
  {
    label: 'Loja',
    links: [
      { href: '/admin/produtos', icon: 'bag', label: 'Produtos', permission: 'products.manage' },
      { href: '/admin/pedidos', icon: 'receipt', label: 'Pedidos', permission: 'orders.read' },
      {
        href: '/admin/remessas',
        icon: 'box-seam',
        label: 'Remessas',
        permission: 'campaigns.manage'
      }
    ]
  },
  {
    label: 'Parceiros',
    links: [
      { href: '/admin/parceiros', icon: 'shop', label: 'Parceiros', permission: 'partners.manage' },
      {
        href: '/admin/servicos',
        icon: 'briefcase',
        label: 'Profissionais e serviços',
        permission: 'services.manage'
      },
      {
        href: '/admin/agendamentos',
        icon: 'calendar-event',
        label: 'Agendamentos',
        permission: 'appointments.manage'
      },
      {
        href: '/admin/repasses',
        icon: 'currency-exchange',
        label: 'Repasses',
        permission: 'settlements.manage'
      }
    ]
  },
  {
    label: 'Comunicação',
    links: [
      { href: '/admin/noticias', icon: 'newspaper', label: 'Notícias', permission: 'news.manage' },
      {
        href: '/admin/eventos',
        icon: 'calendar3',
        label: 'Eventos e partidas',
        permission: 'events.manage'
      },
      {
        href: '/admin/forum',
        icon: 'chat-square-text',
        label: 'Fórum e moderação',
        permission: 'forum.moderate'
      },
      {
        href: '/admin/notificacoes',
        icon: 'megaphone',
        label: 'Notificações',
        permission: 'notifications.send'
      }
    ]
  },
  {
    label: 'Governança',
    links: [
      {
        href: '/admin/relatorios',
        icon: 'bar-chart',
        label: 'Relatórios',
        permission: 'reports.read'
      },
      { href: '/admin/usuarios', icon: 'person-gear', label: 'Usuários', permission: 'users.read' },
      {
        href: '/admin/papeis',
        icon: 'shield-lock',
        label: 'Papéis e permissões',
        permission: 'users.read'
      },
      {
        href: '/admin/configuracoes',
        icon: 'gear',
        label: 'Configurações',
        permission: 'dashboard.read'
      },
      {
        href: '/admin/auditoria',
        icon: 'clock-history',
        label: 'Auditoria',
        permission: 'audit.read'
      },
      {
        href: '/admin/privacidade',
        icon: 'incognito',
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
                        <Icon name={link.icon} /> {link.label}
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
            <Icon name="list" /> Menu
          </button>
          <span className="spacer" />
          <Link href="/minha-conta">
            <Icon name="person-circle" /> {profile?.name}
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void logout()}>
            <Icon name="box-arrow-right" /> Sair
          </button>
        </header>
        <main id="conteudo" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
