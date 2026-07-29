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
  type FinancialCategoryRecord,
  type FinancialChargeRecord,
  type FinancialPaymentRecord,
  getFinanceError,
  listFinanceRecords
} from '../_lib/finance-api';

export default function FinancialPaymentsPage() {
  const session = useAdminSession();
  const canRecord = session.permissions.includes('finance.payments.record');
  const canReconcile = session.permissions.includes('finance.payments.reconcile');
  const [payments, setPayments] = useState<readonly FinancialPaymentRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly FinancialAccountRecord[]>([]);
  const [categories, setCategories] = useState<readonly FinancialCategoryRecord[]>([]);
  const [charges, setCharges] = useState<readonly FinancialChargeRecord[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [chargeId, setChargeId] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');
  const [surplusDisposition, setSurplusDisposition] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentData, accountData, categoryData, chargeData] = await Promise.all([
        listFinanceRecords<FinancialPaymentRecord>('/payments'),
        listFinanceRecords<FinancialAccountRecord>('/accounts'),
        listFinanceRecords<FinancialCategoryRecord>('/categories'),
        listFinanceRecords<FinancialChargeRecord>('/charges')
      ]);
      const pendingPayments = paymentData.data.filter(({ status }) => status === 'PENDING');
      const openCharges = chargeData.data.filter(({ status }) =>
        ['OPEN', 'PARTIALLY_PAID'].includes(status)
      );
      const incomeCategories = categoryData.data.filter(({ type }) => type === 'INCOME');
      setPayments(paymentData.data);
      setAccounts(accountData.data);
      setCategories(incomeCategories);
      setCharges(openCharges);
      setAccountId((current) => current || accountData.data[0]?.id || '');
      setPaymentId((current) =>
        pendingPayments.some(({ id }) => id === current) ? current : pendingPayments[0]?.id || ''
      );
      setChargeId((current) =>
        openCharges.some(({ id }) => id === current) ? current : openCharges[0]?.id || ''
      );
      setIncomeCategoryId((current) => current || incomeCategories[0]?.id || '');
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível carregar os pagamentos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        '/payments',
        { accountId, amount, paidAt: new Date(paidAt).toISOString() },
        true
      );
      setAmount('');
      setPaidAt('');
      setNotice('Pagamento registrado como pendente para conciliação.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível registrar o pagamento.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createFinanceRecord(
        `/payments/${paymentId}/reconcile`,
        {
          incomeCategoryId,
          allocations: [{ chargeId, amount: allocationAmount }],
          ...(surplusDisposition ? { surplusDisposition } : {}),
          reason: reason.trim()
        },
        true
      );
      setAllocationAmount('');
      setReason('');
      setSurplusDisposition('');
      setNotice('Pagamento conciliado uma única vez; cobrança e razão foram atualizados.');
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, 'Não foi possível conciliar o pagamento.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader
        description="Registre pagamentos pendentes, aloque-os em cobranças e destine excedentes explicitamente."
        title="Pagamentos e conciliação"
      />
      {canRecord ? (
        <section className={styles.panel}>
          <h2>Registrar pagamento</h2>
          <form className={styles.formGrid} onSubmit={recordPayment}>
            <label className={styles.field}>
              Conta de entrada
              <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
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
              Recebido em
              <input
                onChange={(event) => setPaidAt(event.target.value)}
                required
                type="datetime-local"
                value={paidAt}
              />
            </label>
            <button className={styles.button} disabled={submitting || !accountId} type="submit">
              Registrar pendente
            </button>
          </form>
        </section>
      ) : null}
      {canReconcile ? (
        <section className={styles.panel}>
          <h2>Conciliar pagamento</h2>
          <form className={styles.formGrid} onSubmit={reconcile}>
            <label className={styles.field}>
              Pagamento pendente
              <select onChange={(event) => setPaymentId(event.target.value)} value={paymentId}>
                {payments
                  .filter(({ status }) => status === 'PENDING')
                  .map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      {formatMoney(payment.amount)} · {payment.account.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.field}>
              Cobrança
              <select onChange={(event) => setChargeId(event.target.value)} value={chargeId}>
                {charges.map((charge) => (
                  <option key={charge.id} value={charge.id}>
                    {charge.referenceCode} · saldo {formatMoney(charge.outstandingAmount)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Categoria de entrada
              <select
                onChange={(event) => setIncomeCategoryId(event.target.value)}
                value={incomeCategoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Valor alocado
              <input
                onChange={(event) => setAllocationAmount(event.target.value)}
                required
                value={allocationAmount}
              />
            </label>
            <label className={styles.field}>
              Destinação do excedente
              <select
                onChange={(event) => setSurplusDisposition(event.target.value)}
                value={surplusDisposition}
              >
                <option value="">Sem excedente</option>
                <option value="CREDIT">Crédito</option>
                <option value="RETURN_PENDING">Devolução pendente</option>
                <option value="REVIEW_REQUIRED">Revisão necessária</option>
              </select>
            </label>
            <label className={`${styles.field} ${styles.wideField}`}>
              Motivo
              <input
                minLength={3}
                onChange={(event) => setReason(event.target.value)}
                required
                value={reason}
              />
            </label>
            <button
              className={styles.button}
              disabled={submitting || !paymentId || !chargeId || !incomeCategoryId}
              type="submit"
            >
              Conciliar
            </button>
          </form>
        </section>
      ) : null}
      <Feedback error={error} notice={notice} />
      <CollectionState isEmpty={payments.length === 0} loading={loading}>
        <div className={styles.recordGrid}>
          {payments.map((payment) => (
            <article className={styles.recordCard} key={payment.id}>
              <div className={styles.cardHeader}>
                <h3>{formatMoney(payment.amount)}</h3>
                <StatusBadge>{payment.status}</StatusBadge>
              </div>
              <dl className={styles.metaList}>
                <dt>Conta</dt>
                <dd>{payment.account.name}</dd>
                <dt>Recebido</dt>
                <dd>{formatInstant(payment.paidAt)}</dd>
                <dt>Excedente</dt>
                <dd>
                  {payment.surplus
                    ? `${formatMoney(payment.surplus.amount)} · ${payment.surplus.disposition}`
                    : 'Nenhum'}
                </dd>
              </dl>
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
