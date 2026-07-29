'use client';

import { useAdminSession } from './admin-shell';
import styles from './admin.module.scss';

export default function AdminDashboardPage() {
  const user = useAdminSession();

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Painel administrativo</p>
          <h1>Olá, {user.name.split(' ')[0]}</h1>
          <p>
            Identidade, operação esportiva e Caixa Fênix aparecem conforme as permissões da sua
            conta.
          </p>
        </div>
      </header>

      <section className={styles.grid} aria-label="Resumo das Fases 1 a 3">
        <article className={styles.metric}>
          <span>Sessão</span>
          <strong>Protegida</strong>
          <p>Access token curto, refresh rotativo e expiração por inatividade.</p>
        </article>
        <article className={styles.metric}>
          <span>Autorização</span>
          <strong>{user.roles.join(', ') || 'Sem papel'}</strong>
          <p>{user.permissions.length} permissões efetivas validadas no servidor.</p>
        </article>
        <article className={styles.metric}>
          <span>Escopo</span>
          <strong>Fases 1–3</strong>
          <p>Recortes técnicos disponíveis somente em ambiente local/teste.</p>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Estado operacional</h2>
        </div>
        <div className={styles.notice} role="note">
          Ambiente autorizado somente para desenvolvimento local e testes com dados fictícios.
          Produção permanece bloqueada por governança, LGPD, retenção, menores e canal de segurança.
        </div>
      </section>
    </>
  );
}
