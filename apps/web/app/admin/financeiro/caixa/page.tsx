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
  type CashSessionRecord,
  createFinanceRecord,
  formatInstant,
  formatMoney,
  type FinancialAccountRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function CashFenixPage() {
  const session = useAdminSession();
  const canOpen = session.permissions.includes('finance.cash.operate');
  const canClose = session.permissions.includes('finance.cash.close');
  const [sessions, setSessions] = useState<readonly CashSessionRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRecord[]>([]);
  const [accountId, setAccountId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [cashSessionId, setCashSessionId] = useState('');
  const [countedFinalBalance, setCountedFinalBalance] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionData, accountData] = await Promise.all([
        listFinanceRecords<CashSessionRecord>('/cash-sessions'),
        listFinanceRecords<FinancialAccountRecord>('/accounts')
      ]);
      const cashAccounts = accountData.data.filter(({ type }) => type === 'CASH');
      const openSessions = sessionData.data.filter(({ status }) => status === 'OPEN');
      setSessions(sessionData.data);
      setAccounts(cashAccounts);
      setAccountId((current) => current || cashAccounts[0]?.id || '');
      setCashSessionId((current) =>
        openSessions.some(({ id }) => id === current) ? current : openSessions[0]?.id || ''
      );
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar o Caixa Fênix.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord('/cash-sessions', { accountId, openingBalance });
      setOpeningBalance('');
      setNotice('Caixa aberto; apenas uma sessão por conta pode permanecer aberta.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível abrir o caixa.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(`/cash-sessions/${cashSessionId}/close`, {
        countedFinalBalance,
        ...(reason.trim() ? { reason: reason.trim() } : {})
      });
      setCountedFinalBalance('');
      setReason('');
      setNotice('Caixa fechado com entradas, saídas, ajustes e diferença registrados.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível fechar o caixa.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader
        description="Fechamento calcula o saldo esperado pelo razão e registra a contagem e a diferença."
        title="Fechamento do Caixa Fênix"
      />
      {canOpen ? (
        <section className={styles.panel}>
          <h2>Abrir caixa</h2>
          <form className={styles.formGrid} onSubmit={open}>
            <label className={styles.field}>
              Conta caixa
              <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Saldo inicial contado
              <input
                onChange={(event) => setOpeningBalance(event.target.value)}
                required
                value={openingBalance}
              />
            </label>
            <button className={styles.button} disabled={submitting || !accountId} type="submit">
              Abrir caixa
            </button>
          </form>
        </section>
      ) : null}
      {canClose ? (
        <section className={styles.panel}>
          <h2>Fechar caixa aberto</h2>
          <form className={styles.formGrid} onSubmit={close}>
            <label className={styles.field}>
              Sessão
              <select
                onChange={(event) => setCashSessionId(event.target.value)}
                value={cashSessionId}
              >
                {sessions
                  .filter(({ status }) => status === 'OPEN')
                  .map((cashSession) => (
                    <option key={cashSession.id} value={cashSession.id}>
                      {cashSession.account.name} · {formatInstant(cashSession.openedAt)}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.field}>
              Saldo final contado
              <input
                onChange={(event) => setCountedFinalBalance(event.target.value)}
                required
                value={countedFinalBalance}
              />
            </label>
            <label className={styles.field}>
              Motivo/observação
              <input onChange={(event) => setReason(event.target.value)} value={reason} />
            </label>
            <button className={styles.button} disabled={submitting || !cashSessionId} type="submit">
              Fechar e conferir
            </button>
          </form>
        </section>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={sessions.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {sessions.map((cashSession) => (
            <article className={styles.recordCard} key={cashSession.id}>
              <div className={styles.cardHeader}>
                <h3>{cashSession.account.name}</h3>
                <StatusBadge>{cashSession.status}</StatusBadge>
              </div>
              <dl className={styles.metaList}>
                <dt>Saldo inicial</dt>
                <dd>{formatMoney(cashSession.openingBalance)}</dd>
                <dt>Movimentações</dt>
                <dd>{cashSession.transactionCount}</dd>
                {cashSession.closing ? (
                  <>
                    <dt>Esperado</dt>
                    <dd>{formatMoney(cashSession.closing.expectedFinalBalance)}</dd>
                    <dt>Contado</dt>
                    <dd>{formatMoney(cashSession.closing.countedFinalBalance)}</dd>
                    <dt>Diferença</dt>
                    <dd>{formatMoney(cashSession.closing.differenceAmount)}</dd>
                  </>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
