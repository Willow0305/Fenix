'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import styles from '../../esportivo/esportivo.module.scss';
import {
  CollectionState,
  Feedback,
  FinancePageHeader,
  StatusBadge
} from '../_components/finance-ui';
import {
  createFinanceRecord,
  formatCivilDate,
  formatMoney,
  type FinancialPlanRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function FinancialPlansPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('finance.plans.manage');
  const [plans, setPlans] = useState<readonly FinancialPlanRecord[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState('');
  const [amount, setAmount] = useState('');
  const [billingDay, setBillingDay] = useState('10');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await listFinanceRecords<FinancialPlanRecord>('/plans')).data;
      setPlans(data);
      setPlanId((current) => current || data[0]?.id || '');
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar os planos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord('/plans', {
        code: code.trim().toLocaleUpperCase('pt-BR'),
        name: name.trim()
      });
      setCode('');
      setName('');
      setNotice('Plano criado. Crie uma versão para definir valor e vigência.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível criar o plano.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(`/plans/${planId}/versions`, {
        amount,
        billingDay: Number(billingDay),
        effectiveFrom
      });
      setAmount('');
      setEffectiveFrom('');
      setNotice('Nova versão imutável criada; versões anteriores foram preservadas.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível criar a versão.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader
        description="Cada alteração de valor gera uma versão imutável; cobranças guardam o snapshot original."
        title="Planos e versões"
      />
      {canManage ? (
        <>
          <section className={styles.panel}>
            <h2>Novo plano</h2>
            <form className={styles.formGrid} onSubmit={createPlan}>
              <label className={styles.field}>
                Código
                <input onChange={(event) => setCode(event.target.value)} required value={code} />
              </label>
              <label className={styles.field}>
                Nome
                <input onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <button className={styles.button} disabled={submitting} type="submit">
                Criar plano
              </button>
            </form>
          </section>
          <section className={styles.panel}>
            <h2>Nova versão</h2>
            <form className={styles.formGrid} onSubmit={createVersion}>
              <label className={styles.field}>
                Plano
                <select onChange={(event) => setPlanId(event.target.value)} required value={planId}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Valor BRL
                <input
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  pattern="\d+(?:\.\d{1,4})?"
                  required
                  value={amount}
                />
              </label>
              <label className={styles.field}>
                Dia de cobrança
                <input
                  max={28}
                  min={1}
                  onChange={(event) => setBillingDay(event.target.value)}
                  required
                  type="number"
                  value={billingDay}
                />
              </label>
              <label className={styles.field}>
                Vigência inicial
                <input
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  required
                  type="date"
                  value={effectiveFrom}
                />
              </label>
              <button className={styles.button} disabled={submitting || !planId} type="submit">
                Criar versão
              </button>
            </form>
          </section>
        </>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={plans.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {plans.map((plan) => (
            <article className={styles.recordCard} key={plan.id}>
              <div className={styles.cardHeader}>
                <h3>{plan.name}</h3>
                <StatusBadge>{plan.status}</StatusBadge>
              </div>
              <p>{plan.code}</p>
              <dl className={styles.metaList}>
                {plan.versions.map((version) => (
                  <div key={version.id}>
                    <dt>Versão {version.version}</dt>
                    <dd>
                      {formatMoney(version.amount)} · dia {version.billingDay} · desde{' '}
                      {formatCivilDate(version.effectiveFrom)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
