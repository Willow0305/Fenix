import type { ReactNode } from 'react';

import styles from '../esportivo.module.scss';

interface SportsPageHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function SportsPageHeader({ eyebrow, title, description, action }: SportsPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className={styles.headerAction}>{action}</div> : null}
    </header>
  );
}

interface FeedbackProps {
  readonly error: string;
  readonly notice: string;
}

export function Feedback({ error, notice }: FeedbackProps) {
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

interface CollectionStateProps {
  readonly loading: boolean;
  readonly isEmpty: boolean;
  readonly emptyMessage: string;
  readonly children: ReactNode;
}

export function CollectionState({
  loading,
  isEmpty,
  emptyMessage,
  children
}: CollectionStateProps) {
  if (loading) {
    return (
      <p className={styles.empty} aria-busy="true" aria-live="polite">
        Carregando registros…
      </p>
    );
  }

  if (isEmpty) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return <>{children}</>;
}

export function StatusBadge({ value }: { readonly value: string }) {
  return <span className={styles.badge}>{value}</span>;
}
