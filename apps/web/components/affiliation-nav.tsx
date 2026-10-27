'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '../lib/auth-context';
import { Icon } from './icon';

const TABS = [
  { href: '/admin/afiliacao', icon: 'grid', label: 'Visão geral', permission: 'cards.read' },
  { href: '/admin/afiliacao/planos', icon: 'tags', label: 'Planos', permission: 'products.manage' },
  {
    href: '/admin/afiliacao/beneficios',
    icon: 'percent',
    label: 'Benefícios',
    permission: 'benefits.manage'
  },
  {
    href: '/admin/afiliacao/carteirinhas',
    icon: 'person-vcard',
    label: 'Carteirinhas',
    permission: 'cards.read'
  },
  { href: '/admin/afiliacao/visual', icon: 'palette', label: 'Visual', permission: 'cards.read' }
] as const;

/** Abas da área Afiliação (DT-072): planos, benefícios, carteirinhas e visual juntos. */
export function AffiliationNav() {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <nav className="subnav" aria-label="Afiliação">
      {TABS.filter((tab) => can(tab.permission)).map((tab) => {
        const current =
          tab.href === '/admin/afiliacao' ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <Link key={tab.href} href={tab.href} aria-current={current ? 'page' : undefined}>
            <Icon name={tab.icon} /> {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
