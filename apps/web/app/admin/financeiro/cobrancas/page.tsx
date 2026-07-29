'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  type FinancialChargeRecord,
  type FinancialPlanRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function FinancialChargesPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('finance.charges.manage');
  const [charges, setCharges] = useState<readonly FinancialChargeRecord[]>([]);
  const [plans, setPlans] = useState<readonly FinancialPlanRecord[]>([]);
  const [referenceCode, setReferenceCode] = useState('');
  const [planVersionId, setPlanVersionId] = useState('');
  const [description, setDescription] = useState('');
  const [competence, setCompetence] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const versions = useMemo(
    () =>
      plans.flatMap((plan) =>
        plan.versions.map((version) => ({ ...version, planName: plan.name }))
      ),
    [plans]
  );
  const selectedVersion = versions.find(({ id }) => id === planVersionId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chargeResponse, planResponse] = await Promise.all([
        listFinanceRecords<FinancialChargeRecord>('/charges'),
        listFinanceRecords<FinancialPlanRecord>('/plans')
      ]);
      setCharges(chargeResponse.data);
      setPlans(planResponse.data);
      setPlanVersionId((current) => current || planResponse.data[0]?.versions[0]?.id || '');
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar as cobranças.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVersion) return;
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        '/charges',
        {
          referenceCode: referenceCode.trim().toLocaleUpperCase('pt-BR'),
          planVersionId,
          description: description.trim(),
          competence: `${competence}-01`,
          dueDate,
          amount: selectedVersion.amount
        },
        true
      );
      setReferenceCode('');
      setDescription('');
      setNotice('Cobrança criada com valor e regra da versão preservados.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível criar a cobrança.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader
        description="Cobranças por competência preservam o valor original e exibem o saldo após alocações."
        title="Cobranças"
      />
      {canManage ? (
        <section className={styles.panel}>
          <h2>Nova cobrança fictícia</h2>
          <form className={styles.formGrid} onSubmit={submit}>
            <label className={styles.field}>
              Referência
              <input
                onChange={(event) => setReferenceCode(event.target.value)}
                required
                value={referenceCode}
              />
            </label>
            <label className={styles.field}>
              Plano e versão
              <select
                onChange={(event) => setPlanVersionId(event.target.value)}
                required
                value={planVersionId}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.planName} · v{version.version} · {formatMoney(version.amount)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Competência
              <input
                onChange={(event) => setCompetence(event.target.value)}
                required
                type="month"
                value={competence}
              />
            </label>
            <label className={styles.field}>
              Vencimento
              <input
                onChange={(event) => setDueDate(event.target.value)}
                required
                type="date"
                value={dueDate}
              />
            </label>
            <label className={`${styles.field} ${styles.wideField}`}>
              Descrição
              <input
                onChange={(event) => setDescription(event.target.value)}
                required
                value={description}
              />
            </label>
            <button
              className={styles.button}
              disabled={submitting || !selectedVersion}
              type="submit"
            >
              Criar cobrança
            </button>
          </form>
        </section>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={charges.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {charges.map((charge) => (
            <article className={styles.recordCard} key={charge.id}>
              <div className={styles.cardHeader}>
                <h3>{charge.referenceCode}</h3>
                <StatusBadge>{charge.status}</StatusBadge>
              </div>
              <p>{charge.description}</p>
              <dl className={styles.metaList}>
                <dt>Competência</dt>
                <dd>{formatCivilDate(charge.competence)}</dd>
                <dt>Original</dt>
                <dd>{formatMoney(charge.originalAmount)}</dd>
                <dt>Saldo aberto</dt>
                <dd>{formatMoney(charge.outstandingAmount)}</dd>
              </dl>
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
