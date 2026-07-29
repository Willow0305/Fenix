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
  formatInstant,
  formatMoney,
  type CostCenterRecord,
  type FinancialAccountRecord,
  type FinancialCategoryRecord,
  type FinancialTransactionRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function FinancialEntriesPage() {
  const session = useAdminSession();
  const canCreate = session.permissions.includes('finance.entries.create');
  const canApprove = session.permissions.includes('finance.entries.approve');
  const canReverse = session.permissions.includes('finance.reverse');
  const [entries, setEntries] = useState<readonly FinancialTransactionRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRecord[]>([]);
  const [categories, setCategories] = useState<readonly FinancialCategoryRecord[]>([]);
  const [costCenters, setCostCenters] = useState<readonly CostCenterRecord[]>([]);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entryData, accountData, categoryData, centerData] = await Promise.all([
        listFinanceRecords<FinancialTransactionRecord>('/transactions'),
        listFinanceRecords<FinancialAccountRecord>('/accounts'),
        listFinanceRecords<FinancialCategoryRecord>('/categories'),
        listFinanceRecords<CostCenterRecord>('/cost-centers')
      ]);
      setEntries(entryData.data);
      setAccounts(accountData.data);
      setCategories(categoryData.data);
      setCostCenters(centerData.data);
      setAccountId((current) => current || accountData.data[0]?.id || '');
      setCategoryId(
        (current) =>
          current || categoryData.data.find((category) => category.type === 'EXPENSE')?.id || ''
      );
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar os lançamentos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeType(nextType: 'EXPENSE' | 'INCOME') {
    setType(nextType);
    setCategoryId(categories.find((category) => category.type === nextType)?.id ?? '');
  }

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        '/transactions',
        {
          accountId,
          categoryId,
          ...(costCenterId ? { costCenterId } : {}),
          type,
          amount,
          description: description.trim(),
          occurredAt: new Date(occurredAt).toISOString()
        },
        true
      );
      setAmount('');
      setDescription('');
      setOccurredAt('');
      setNotice('Lançamento registrado como pendente; nenhuma movimentação foi aprovada.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível criar o lançamento.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(
    entry: FinancialTransactionRecord,
    action: 'approve' | 'reject' | 'reverse'
  ) {
    if (decisionReason.trim().length < 3) {
      setError('Informe um motivo com pelo menos 3 caracteres antes da decisão.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        `/transactions/${entry.id}/${action}`,
        { reason: decisionReason.trim() },
        action === 'reverse'
      );
      setDecisionReason('');
      setNotice(`Decisão “${action}” registrada com trilha auditável.`);
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível registrar a decisão.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader
        description="Assistentes registram pendências; tesoureiros aprovam, rejeitam ou criam reversões."
        title="Lançamentos e aprovações"
      />
      {canCreate ? (
        <section className={styles.panel}>
          <h2>Novo lançamento pendente</h2>
          <form className={styles.formGrid} onSubmit={createEntry}>
            <label className={styles.field}>
              Tipo
              <select
                onChange={(event) => changeType(event.target.value as 'EXPENSE' | 'INCOME')}
                value={type}
              >
                <option value="EXPENSE">Saída</option>
                <option value="INCOME">Entrada</option>
              </select>
            </label>
            <label className={styles.field}>
              Conta
              <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Categoria
              <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                {categories
                  .filter((category) => category.type === type)
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
              Valor
              <input onChange={(event) => setAmount(event.target.value)} required value={amount} />
            </label>
            <label className={styles.field}>
              Data e hora
              <input
                onChange={(event) => setOccurredAt(event.target.value)}
                required
                type="datetime-local"
                value={occurredAt}
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
            <button className={styles.button} disabled={submitting || !categoryId} type="submit">
              Registrar pendente
            </button>
          </form>
        </section>
      ) : null}
      {canApprove || canReverse ? (
        <section className={styles.panel}>
          <h2>Motivo da próxima decisão</h2>
          <label className={styles.field}>
            Motivo obrigatório
            <input
              minLength={3}
              onChange={(event) => setDecisionReason(event.target.value)}
              value={decisionReason}
            />
          </label>
        </section>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={entries.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {entries.map((entry) => (
            <article className={styles.recordCard} key={entry.id}>
              <div className={styles.cardHeader}>
                <h3>{formatMoney(entry.amount)}</h3>
                <StatusBadge>{entry.status}</StatusBadge>
              </div>
              <p>{entry.description}</p>
              <dl className={styles.metaList}>
                <dt>Conta</dt>
                <dd>{entry.account.name}</dd>
                <dt>Ocorrência</dt>
                <dd>{formatInstant(entry.occurredAt)}</dd>
              </dl>
              {canApprove && entry.status === 'PENDING' ? (
                <div className={styles.cardActions}>
                  <button
                    className={styles.button}
                    disabled={submitting}
                    onClick={() => void decide(entry, 'approve')}
                    type="button"
                  >
                    Aprovar
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={submitting}
                    onClick={() => void decide(entry, 'reject')}
                    type="button"
                  >
                    Rejeitar
                  </button>
                </div>
              ) : null}
              {canReverse && entry.status === 'APPROVED' ? (
                <button
                  className={styles.secondaryButton}
                  disabled={submitting}
                  onClick={() => void decide(entry, 'reverse')}
                  type="button"
                >
                  Criar reversão
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
