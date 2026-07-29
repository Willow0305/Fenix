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
  type CostCenterRecord,
  type FinancialAccountRecord,
  type FinancialCategoryRecord,
  type FinancialObligationRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function FinancialObligationsPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('finance.obligations.manage');
  const [obligations, setObligations] = useState<readonly FinancialObligationRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRecord[]>([]);
  const [categories, setCategories] = useState<readonly FinancialCategoryRecord[]>([]);
  const [costCenters, setCostCenters] = useState<readonly CostCenterRecord[]>([]);
  const [type, setType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [obligationData, accountData, categoryData, centerData] = await Promise.all([
        listFinanceRecords<FinancialObligationRecord>('/obligations'),
        listFinanceRecords<FinancialAccountRecord>('/accounts'),
        listFinanceRecords<FinancialCategoryRecord>('/categories'),
        listFinanceRecords<CostCenterRecord>('/cost-centers')
      ]);
      setObligations(obligationData.data);
      setAccounts(accountData.data);
      setCategories(categoryData.data);
      setCostCenters(centerData.data);
      setCategoryId(
        (current) =>
          current || categoryData.data.find((category) => category.type === 'EXPENSE')?.id || ''
      );
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar as obrigações.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeType(nextType: 'PAYABLE' | 'RECEIVABLE') {
    setType(nextType);
    const categoryType = nextType === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
    setCategoryId(categories.find((category) => category.type === categoryType)?.id ?? '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord('/obligations', {
        type,
        categoryId,
        ...(costCenterId ? { costCenterId } : {}),
        ...(accountId ? { accountId } : {}),
        referenceCode: referenceCode.trim().toLocaleUpperCase('pt-BR'),
        description: description.trim(),
        dueDate,
        amount
      });
      setReferenceCode('');
      setDescription('');
      setDueDate('');
      setAmount('');
      setNotice('Obrigação criada. Liquidações são feitas por lançamentos aprovados.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível criar a obrigação.'));
    } finally {
      setSubmitting(false);
    }
  }

  const categoryType = type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';

  return (
    <>
      <FinancePageHeader
        description="Contas a pagar e receber mantêm saldo por movimentações aprovadas, nunca por edição manual."
        title="Contas a pagar e receber"
      />
      {canManage ? (
        <section className={styles.panel}>
          <h2>Nova obrigação</h2>
          <form className={styles.formGrid} onSubmit={submit}>
            <label className={styles.field}>
              Tipo
              <select
                onChange={(event) => changeType(event.target.value as 'PAYABLE' | 'RECEIVABLE')}
                value={type}
              >
                <option value="PAYABLE">A pagar</option>
                <option value="RECEIVABLE">A receber</option>
              </select>
            </label>
            <label className={styles.field}>
              Categoria
              <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                {categories
                  .filter((category) => category.type === categoryType)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.field}>
              Centro de custo
              <select
                onChange={(event) => setCostCenterId(event.target.value)}
                value={costCenterId}
              >
                <option value="">Não vincular</option>
                {costCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Conta prevista
              <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
                <option value="">Não definir</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Referência
              <input
                onChange={(event) => setReferenceCode(event.target.value)}
                required
                value={referenceCode}
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
            <label className={styles.field}>
              Valor
              <input onChange={(event) => setAmount(event.target.value)} required value={amount} />
            </label>
            <label className={`${styles.field} ${styles.wideField}`}>
              Descrição
              <input
                onChange={(event) => setDescription(event.target.value)}
                required
                value={description}
              />
            </label>
            <button className={styles.button} disabled={submitting || !categoryId} type="submit">
              Criar obrigação
            </button>
          </form>
        </section>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={obligations.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {obligations.map((obligation) => (
            <article className={styles.recordCard} key={obligation.id}>
              <div className={styles.cardHeader}>
                <h3>{obligation.referenceCode}</h3>
                <StatusBadge>{obligation.status}</StatusBadge>
              </div>
              <p>{obligation.description}</p>
              <dl className={styles.metaList}>
                <dt>Total</dt>
                <dd>{formatMoney(obligation.amount)}</dd>
                <dt>Liquidado</dt>
                <dd>{formatMoney(obligation.approvedSettlementAmount)}</dd>
                <dt>Vencimento</dt>
                <dd>{formatCivilDate(obligation.dueDate)}</dd>
              </dl>
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
