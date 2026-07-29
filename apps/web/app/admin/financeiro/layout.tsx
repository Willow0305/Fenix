import type { ReactNode } from 'react';

import styles from '../esportivo/esportivo.module.scss';
import { FinanceSectionNav } from './_components/finance-section-nav';

export default function FinanceLayout({ children }: { readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.environmentNotice} role="note">
        Primeira entrega da Fase 3: use somente dados fictícios. Gateway, PIX real, banco e
        mensalidades automáticas não estão habilitados; produção permanece bloqueada.
      </div>
      <FinanceSectionNav />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
