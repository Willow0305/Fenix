import Link from 'next/link';

import styles from '../auth.module.scss';

export default function SessionExpiredPage() {
  return (
    <main className={styles.centerPage}>
      <section className={styles.messageCard} aria-labelledby="expired-title">
        <p className={styles.eyebrow}>Proteção da conta</p>
        <h1 id="expired-title">Sessão expirada</h1>
        <p>Sua sessão terminou por expiração, inatividade ou revogação. Entre novamente.</p>
        <Link href="/login">Entrar novamente</Link>
      </section>
    </main>
  );
}
