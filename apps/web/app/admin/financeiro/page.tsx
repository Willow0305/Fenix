'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import styles from '../esportivo/esportivo.module.scss';
import { FinancePageHeader } from './_components/finance-ui';
import {
  formatMoney,
  getFinanceError,
  getFinanceSummary,
  type FinanceSummary
} from './_lib/finance-api';

const MODULES = [
  ['/admin/financeiro/contas', 'Contas', 'Contas financeiras e caixa físico.'],
  ['/admin/financeiro/categorias', 'Categorias', 'Entradas e saídas do razão.'],
  ['/admin/financeiro/centros-de-custo', 'Centros de custo', 'Finalidade dos recursos.'],
  ['/admin/financeiro/planos', 'Planos e versões', 'Valores imutáveis por vigência.'],
  ['/admin/financeiro/cobrancas', 'Cobranças', 'Competência e saldo aberto.'],
  ['/admin/financeiro/pagamentos', 'Pagamentos', 'Registro, conciliação e créditos.'],
  ['/admin/financeiro/lancamentos', 'Lançamentos', 'Fila pendente, aprovação e reversão.'],
  ['/admin/financeiro/transferencias', 'Transferências', 'Movimentação neutra entre contas.'],
  ['/admin/financeiro/obrigacoes', 'Pagar e receber', 'Obrigações e liquidações.'],
  ['/admin/financeiro/caixa', 'Caixa Fênix', 'Abertura e fechamento conferido.']
] as const;

export default function FinanceHubPage() {
  const [summary, setSummary] = useState<FinanceSummary>();
  const [error, setError] = useState('');

  useEffect(() => {
    getFinanceSummary()
      .then(setSummary)
      .catch((requestError: unknown) => {
        setError(getFinanceError(requestError, 'Não foi possível carregar o resumo financeiro.'));
      });
  }, []);

  return (
    <>
      <FinancePageHeader
        description="Primeira entrega vertical do razão, conciliação, aprovações e fechamento do caixa."
        title="Caixa Fênix"
      />
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      <section className={styles.panel} aria-label="Indicadores financeiros">
        <div className={styles.recordGrid}>
          <article className={styles.recordCard}>
            <h3>Saldo derivado</h3>
            <strong>{summary ? formatMoney(summary.derivedBalance) : 'Carregando…'}</strong>
          </article>
          <article className={styles.recordCard}>
            <h3>Cobranças abertas</h3>
            <strong>{summary?.openCharges ?? '—'}</strong>
          </article>
          <article className={styles.recordCard}>
            <h3>Decisões pendentes</h3>
            <strong>{summary ? summary.pendingEntries + summary.pendingPayments : '—'}</strong>
          </article>
        </div>
      </section>
      <div className={styles.hubGrid}>
        {MODULES.map(([href, title, description]) => (
          <Link className={styles.hubCard} href={href} key={href}>
            <strong>{title}</strong>
            <span>{description}</span>
            <small>Abrir módulo →</small>
          </Link>
        ))}
      </div>
    </>
  );
}
