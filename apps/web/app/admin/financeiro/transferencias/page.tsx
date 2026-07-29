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
  type FinancialAccountRecord,
  type FinancialTransferRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function FinancialTransfersPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('finance.transfers.manage');
  const [transfers, setTransfers] = useState<readonly FinancialTransferRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRecord[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [transferData, accountData] = await Promise.all([
        listFinanceRecords<FinancialTransferRecord>('/transfers'),
        listFinanceRecords<FinancialAccountRecord>('/accounts')
      ]);
      setTransfers(transferData.data);
      setAccounts(accountData.data);
      setSourceAccountId((current) => current || accountData.data[0]?.id || '');
      setTargetAccountId((current) => current || accountData.data[1]?.id || '');
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar as transferências.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        '/transfers',
        {
          sourceAccountId,
          targetAccountId,
          amount,
          description: description.trim(),
          occurredAt: new Date(occurredAt).toISOString()
        },
        true
      );
      setAmount('');
      setDescription('');
      setOccurredAt('');
      setNotice('Transferência criada como pendente.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível criar a transferência.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(
    transfer: FinancialTransferRecord,
    action: 'approve' | 'reject' | 'reverse'
  ) {
    if (reason.trim().length < 3) {
      setError('Informe o motivo da decisão.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        `/transfers/${transfer.id}/${action}`,
        { reason: reason.trim() },
        action === 'reverse'
      );
      setReason('');
      setNotice('Decisão registrada. Transferências não compõem receita nem despesa.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível decidir a transferência.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader
        description="Uma transferência aprovada cria duas pernas neutras; correções usam duas reversões."
        title="Transferências"
      />
      {canManage ? (
        <>
          <section className={styles.panel}>
            <h2>Nova transferência</h2>
            <form className={styles.formGrid} onSubmit={createTransfer}>
              <label className={styles.field}>
                Origem
                <select
                  onChange={(event) => setSourceAccountId(event.target.value)}
                  value={sourceAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Destino
                <select
                  onChange={(event) => setTargetAccountId(event.target.value)}
                  value={targetAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Valor
                <input
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  value={amount}
                />
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
              <button
                className={styles.button}
                disabled={submitting || sourceAccountId === targetAccountId}
                type="submit"
              >
                Criar pendente
              </button>
            </form>
          </section>
          <section className={styles.panel}>
            <label className={styles.field}>
              Motivo da decisão
              <input onChange={(event) => setReason(event.target.value)} value={reason} />
            </label>
          </section>
        </>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={transfers.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {transfers.map((transfer) => (
            <article className={styles.recordCard} key={transfer.id}>
              <div className={styles.cardHeader}>
                <h3>{formatMoney(transfer.amount)}</h3>
                <StatusBadge>{transfer.status}</StatusBadge>
              </div>
              <p>
                {transfer.sourceAccount.name} → {transfer.targetAccount.name}
              </p>
              <small>{formatInstant(transfer.occurredAt)}</small>
              {canManage && transfer.status === 'PENDING' ? (
                <div className={styles.cardActions}>
                  <button
                    className={styles.button}
                    onClick={() => void decide(transfer, 'approve')}
                    type="button"
                  >
                    Aprovar
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => void decide(transfer, 'reject')}
                    type="button"
                  >
                    Rejeitar
                  </button>
                </div>
              ) : null}
              {canManage && transfer.status === 'APPROVED' ? (
                <button
                  className={styles.secondaryButton}
                  onClick={() => void decide(transfer, 'reverse')}
                  type="button"
                >
                  Reverter
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
