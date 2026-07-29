'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAdminSession } from '../../admin-shell';
import styles from '../esportivo.module.scss';

const ITEMS = [
  { href: '/admin/esportivo', label: 'Resumo', permission: 'sports.read' },
  { href: '/admin/esportivo/equipes', label: 'Equipes', permission: 'sports.read' },
  { href: '/admin/esportivo/categorias', label: 'Categorias', permission: 'sports.read' },
  { href: '/admin/esportivo/atletas', label: 'Atletas', permission: 'athletes.read' },
  { href: '/admin/esportivo/responsaveis', label: 'Responsáveis', permission: 'sports.read' },
  { href: '/admin/esportivo/seletivas', label: 'Seletivas', permission: 'sports.read' },
  {
    href: '/admin/esportivo/inscricoes',
    label: 'Inscrições',
    permission: 'registrations.read'
  },
  {
    href: '/admin/esportivo/conversao',
    label: 'Conversão',
    permission: 'registrations.convert'
  }
] as const;

export function SportsSectionNav() {
  const pathname = usePathname();
  const session = useAdminSession();

  return (
    <nav className={styles.sectionNav} aria-label="Módulo esportivo">
      {ITEMS.filter((item) => session.permissions.includes(item.permission)).map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin/esportivo' && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={active ? styles.sectionNavActive : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
