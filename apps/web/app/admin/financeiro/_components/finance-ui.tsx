import type { ReactNode } from 'react';

import styles from '../../esportivo/esportivo.module.scss';

export function FinancePageHeader({
  title,
  description
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>Caixa Fênix · Fase 3</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

export function Feedback({ error, notice }: { readonly error: string; readonly notice: string }) {
  return (
    <>
      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}

export function CollectionState({
  loading,
  isEmpty,
  children
}: {
  readonly loading: boolean;
  readonly isEmpty: boolean;
  readonly children: ReactNode;
}) {
  if (loading) {
    return (
      <p className={styles.empty} aria-busy="true">
        Carregando dados financeiros…
      </p>
    );
  }

  return isEmpty ? (
    <p className={styles.empty}>Nenhum registro fictício neste ambiente.</p>
  ) : (
    <>{children}</>
  );
}

export function StatusBadge({ children }: { readonly children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}
