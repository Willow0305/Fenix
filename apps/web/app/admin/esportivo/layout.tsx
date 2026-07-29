import type { ReactNode } from 'react';

import { SportsSectionNav } from './_components/sports-section-nav';
import styles from './esportivo.module.scss';

export default function SportsLayout({ children }: { readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.environmentNotice} role="note">
        Primeira entrega da Fase 2: use exclusivamente dados fictícios. Dados médicos não fazem
        parte deste módulo e dados reais de menores permanecem bloqueados.
      </div>
      <SportsSectionNav />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
