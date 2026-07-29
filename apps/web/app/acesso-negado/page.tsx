import Link from 'next/link';

import styles from '../auth.module.scss';

export default function AccessDeniedPage() {
  return (
    <main className={styles.centerPage}>
      <section className={styles.messageCard} aria-labelledby="denied-title">
        <p className={styles.eyebrow}>Permissão insuficiente</p>
        <h1 id="denied-title">Acesso negado</h1>
        <p>
          Sua conta está autenticada, mas não possui autorização para esta área. A tentativa foi
          protegida pelo servidor.
        </p>
        <Link href="/login">Voltar ao login</Link>
      </section>
    </main>
  );
}
