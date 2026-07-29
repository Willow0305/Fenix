'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from '../../esportivo/esportivo.module.scss';

const LINKS = [
  ['/admin/financeiro', 'Visão geral'],
  ['/admin/financeiro/contas', 'Contas'],
  ['/admin/financeiro/categorias', 'Categorias'],
  ['/admin/financeiro/centros-de-custo', 'Centros de custo'],
  ['/admin/financeiro/planos', 'Planos'],
  ['/admin/financeiro/cobrancas', 'Cobranças'],
  ['/admin/financeiro/pagamentos', 'Pagamentos'],
  ['/admin/financeiro/lancamentos', 'Lançamentos'],
  ['/admin/financeiro/transferencias', 'Transferências'],
  ['/admin/financeiro/obrigacoes', 'Pagar/receber'],
  ['/admin/financeiro/caixa', 'Fechamento']
] as const;

export function FinanceSectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Caixa Fênix" className={styles.sectionNav}>
      {LINKS.map(([href, label]) => (
        <Link
          className={
            pathname === href || (href !== '/admin/financeiro' && pathname.startsWith(`${href}/`))
              ? styles.sectionNavActive
              : undefined
          }
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
