'use client';

import Link from 'next/link';

import { Alert } from '../../components/ui';
import type { DashboardIndicator } from '../../lib/sports-types';
import { useResource } from '../../lib/use-resource';

/** Indicadores do painel (RF-020): valor, definição e link para a origem. */
export function DashboardIndicators() {
  const summary = useResource<DashboardIndicator[]>('/dashboard/summary');

  if (summary.error) {
    return <Alert kind="error">{summary.error}</Alert>;
  }

  return (
    <section aria-labelledby="indicadores" aria-busy={summary.loading}>
      <h2 id="indicadores" className="visually-hidden">
        Indicadores
      </h2>
      <div className="stat-grid">
        {(summary.data ?? []).map((indicator) => (
          <Link
            key={indicator.key}
            href={indicator.link}
            className="stat"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <div className="stat-label">{indicator.label}</div>
            <div className="stat-value">{indicator.value}</div>
            <small className="muted" title={indicator.definition}>
              {indicator.definition}
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}
