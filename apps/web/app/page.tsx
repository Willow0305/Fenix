import { TechnicalStatus } from '@fenix/ui';

import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section aria-labelledby="page-title" className={styles.card}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Fundação técnica · Fase 0</p>
          <h1 id="page-title">Fênix Vôlei</h1>
          <p className={styles.lead}>
            Uma base segura e modular para evoluir o sistema, etapa por etapa.
          </p>
        </header>

        <TechnicalStatus
          className={styles.status}
          indicatorClassName={styles.statusIndicator}
          label="Esqueleto técnico operacional"
        >
          <span className={styles.statusDescription}>
            Esta página confirma a renderização da interface inicial.
          </span>
        </TechnicalStatus>

        <dl aria-label="Tecnologias validadas pela interface" className={styles.stack}>
          <div>
            <dt>Interface</dt>
            <dd>Next.js e React</dd>
          </div>
          <div>
            <dt>Contrato</dt>
            <dd>TypeScript strict</dd>
          </div>
          <div>
            <dt>Estilos</dt>
            <dd>SCSS Modules</dd>
          </div>
        </dl>

        <footer className={styles.footer}>
          Esta tela valida somente a infraestrutura. Nenhum módulo de negócio está ativo.
        </footer>
      </section>
    </main>
  );
}
