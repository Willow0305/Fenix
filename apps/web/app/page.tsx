import Link from 'next/link';

import { BrandLogo } from './components/brand-logo';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.navigation} aria-label="Navegação principal">
        <Link className={styles.brand} href="/">
          <BrandLogo />
          Fênix Vôlei
        </Link>
        <Link className={styles.loginLink} href="/login">
          Entrar
        </Link>
      </nav>

      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Gestão integrada · Fases 1–3</p>
          <h1 id="page-title">Uma base segura para organizar o Fênix.</h1>
          <p className={styles.lead}>
            Identidade, operação esportiva e Caixa Fênix reunidos com permissões granulares, sessões
            revogáveis e auditoria funcional.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/login">
              Acessar área restrita
            </Link>
            <Link className={styles.secondaryAction} href="/recuperar-senha">
              Recuperar acesso
            </Link>
          </div>
        </div>

        <aside className={styles.statusCard} aria-label="Escopo vigente">
          <p>Escopo vigente</p>
          <strong>Entregas técnicas das Fases 1–3</strong>
          <ul>
            <li>Login e recuperação segura</li>
            <li>Equipes, atletas e seletivas</li>
            <li>Conciliação e Caixa Fênix</li>
          </ul>
          <small>Somente ambiente local/teste e dados fictícios.</small>
        </aside>
      </section>

      <footer className={styles.footer}>
        <span>Fênix Vôlei</span>
        <span>Ambiente local/teste com dados fictícios</span>
      </footer>
    </main>
  );
}
