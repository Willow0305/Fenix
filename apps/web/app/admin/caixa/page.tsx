'use client';

import { useState } from 'react';

import { AccountSelect, CategorySelect } from '../../../components/finance-pickers';
import { TransactionForm, TransferForm } from '../../../components/transaction-forms';
import {
  Alert,
  ConfirmDialog,
  Empty,
  Loading,
  PageHeader,
  Pagination
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { openProtectedFile } from '../../../lib/download';
import {
  type FinanceSummary,
  ORIGIN_LABEL,
  type Transaction,
  TRANSACTION_STATUS,
  type TransactionStatus
} from '../../../lib/finance-types';
import { formatDate, formatMoney, todayCivil } from '../../../lib/format';
import { useIdempotencyKey } from '../../../lib/idempotency';
import { useResource } from '../../../lib/use-resource';

type Action = { kind: 'confirm' | 'cancel' | 'reverse'; transaction: Transaction } | null;

function monthStart(): string {
  return `${todayCivil().slice(0, 7)}-01`;
}

export default function CashPage() {
  const { can } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayCivil());
  const [filters, setFilters] = useState({
    accountId: '',
    categoryId: '',
    status: '' as TransactionStatus | '',
    direction: ''
  });
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<'none' | 'transaction' | 'transfer'>('none');
  const [action, setAction] = useState<Action>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reverseKey = useIdempotencyKey();
  const summary = useResource<FinanceSummary>('/finance/summary', { from, to });
  const list = useResource<Page<Transaction>>('/finance/transactions', {
    page,
    pageSize: 30,
    from,
    to,
    ...filters
  });

  async function refresh(message: string) {
    setNotice(message);
    setPanel('none');
    await Promise.all([summary.reload(), list.reload()]);
  }

  async function uploadReceipt(transaction: Transaction, file: File) {
    const form = new FormData();

    form.set('file', file);
    await api(`/finance/transactions/${transaction.id}/attachments`, {
      method: 'POST',
      body: form
    });
    await refresh('Comprovante anexado.');
  }

  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Caixa Fênix"
        description="Saldos derivados dos lançamentos confirmados. Nada é apagado: correções geram estornos vinculados."
        actions={
          <>
            {can('transactions.create') ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPanel(panel === 'transaction' ? 'none' : 'transaction')}
              >
                Novo lançamento
              </button>
            ) : null}
            {can('transactions.create', 'transactions.confirm') ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPanel(panel === 'transfer' ? 'none' : 'transfer')}
              >
                Transferência
              </button>
            ) : null}
          </>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {panel === 'transaction' ? (
        <section className="card">
          <TransactionForm onDone={() => void refresh('Lançamento registrado.')} />
        </section>
      ) : null}
      {panel === 'transfer' ? (
        <section className="card">
          <TransferForm onDone={() => void refresh('Transferência registrada.')} />
        </section>
      ) : null}

      <div className="row">
        <label className="field">
          <span className="label">De</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label className="field">
          <span className="label">Até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </label>
        <span className="muted">Fuso: Rio Branco · Moeda: BRL</span>
      </div>

      {summary.error ? <Alert kind="error">{summary.error}</Alert> : null}
      {s ? (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Saldo total (hoje)</div>
              <div className="stat-value">{formatMoney(s.totalBalance.amount)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Entradas no período</div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                {formatMoney(s.periodIncome.amount)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Saídas no período</div>
              <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
                {formatMoney(s.periodExpense.amount)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Resultado do período</div>
              <div className="stat-value">{formatMoney(s.periodResult.amount)}</div>
            </div>
          </div>
          <div className="stat-grid">
            {s.balances.map((b) => (
              <div key={b.accountId} className="card">
                <div className="muted">{b.accountName}</div>
                <strong>{formatMoney(b.balance.amount)}</strong>
              </div>
            ))}
            <div className="card">
              <div className="muted">Pendências</div>
              <span>
                {s.pendingTransactions} lançamento(s) · {s.pendingPayments} pagamento(s) ·{' '}
                {s.pendingReceipts} despesa(s) sem comprovante
              </span>
            </div>
            <div className="card">
              <div className="muted">A receber / a pagar (contas)</div>
              <span>
                {formatMoney(s.openReceivables.amount)} / {formatMoney(s.openPayables.amount)}
              </span>
            </div>
          </div>
          {s.byCategory.length > 0 ? (
            <details className="card">
              <summary>Por categoria no período</summary>
              <table className="table">
                <tbody>
                  {s.byCategory.map((c) => (
                    <tr key={`${c.categoryId}-${c.direction}`}>
                      <td>{c.categoryName}</td>
                      <td>{c.direction === 'INCOME' ? 'Entrada' : 'Saída'}</td>
                      <td className="num">{formatMoney(c.total.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </>
      ) : (
        <Loading />
      )}

      <section className="stack" aria-labelledby="lancamentos">
        <h2 id="lancamentos">Lançamentos</h2>
        <div className="form-grid">
          <AccountSelect
            label="Conta"
            required={false}
            allowEmpty
            value={filters.accountId}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, accountId: v });
            }}
          />
          <CategorySelect
            allowEmpty
            required={false}
            value={filters.categoryId}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, categoryId: v });
            }}
          />
          <label className="field">
            <span className="label">Situação</span>
            <select
              value={filters.status}
              onChange={(e) => {
                setPage(1);
                setFilters({ ...filters, status: e.target.value as TransactionStatus | '' });
              }}
            >
              <option value="">Todas</option>
              {Object.entries(TRANSACTION_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Tipo</span>
            <select
              value={filters.direction}
              onChange={(e) => {
                setPage(1);
                setFilters({ ...filters, direction: e.target.value });
              }}
            >
              <option value="">Entradas e saídas</option>
              <option value="INCOME">Entradas</option>
              <option value="EXPENSE">Saídas</option>
            </select>
          </label>
        </div>
        {list.error ? <Alert kind="error">{list.error}</Alert> : null}
        {list.data?.data.length === 0 ? <Empty>Nenhum lançamento no período.</Empty> : null}
        {list.data && list.data.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Conta / categoria</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col">Situação</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Data">{formatDate(t.occurredOn)}</td>
                    <td data-label="Descrição">
                      {t.description}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {ORIGIN_LABEL[t.origin]}
                        {t.createdBy ? ` · por ${t.createdBy}` : ''}
                        {t.reversesTransactionId ? ' · estorno' : ''}
                        {t.reversedBy ? ' · estornado' : ''}
                      </div>
                    </td>
                    <td data-label="Conta / categoria">
                      {t.account.name}
                      <div className="muted">{t.category.name}</div>
                    </td>
                    <td
                      className="num"
                      style={{
                        color:
                          t.direction === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)'
                      }}
                    >
                      {t.direction === 'INCOME' ? '+' : '−'} {formatMoney(t.amount.amount)}
                    </td>
                    <td data-label="Valor">
                      <span className={`badge ${TRANSACTION_STATUS[t.status].badge}`}>
                        {TRANSACTION_STATUS[t.status].label}
                      </span>
                    </td>
                    <td data-label="Situação">
                      <div className="row" style={{ gap: '0.3rem' }}>
                        {t.status === 'PENDING' && !t.paymentId && can('transactions.confirm') ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setAction({ kind: 'confirm', transaction: t })}
                          >
                            Confirmar
                          </button>
                        ) : null}
                        {t.status === 'PENDING' && can('transactions.cancel') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setAction({ kind: 'cancel', transaction: t })}
                          >
                            Cancelar
                          </button>
                        ) : null}
                        {t.status === 'CONFIRMED' &&
                        !t.reversedBy &&
                        !t.reversesTransactionId &&
                        !t.paymentId &&
                        t.origin !== 'TRANSFER' &&
                        can('transactions.cancel') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setAction({ kind: 'reverse', transaction: t })}
                          >
                            Estornar
                          </button>
                        ) : null}
                        {t.attachments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="btn btn-link"
                            onClick={() =>
                              void openProtectedFile(
                                `/finance/transactions/${t.id}/attachments/${a.id}`
                              )
                            }
                          >
                            Comprovante
                          </button>
                        ))}
                        {can('transactions.create', 'files.upload') ? (
                          <label className="btn btn-link" style={{ cursor: 'pointer' }}>
                            Anexar
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,application/pdf"
                              className="visually-hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];

                                if (file) {
                                  void uploadReceipt(t, file);
                                }
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {list.data ? <Pagination {...list.data.meta} onChange={setPage} /> : null}
      </section>

      <ConfirmDialog
        open={action !== null}
        title={
          action?.kind === 'confirm'
            ? 'Confirmar lançamento'
            : action?.kind === 'cancel'
              ? 'Cancelar lançamento pendente'
              : 'Estornar lançamento'
        }
        description={
          action
            ? `${action.transaction.description} — ${formatMoney(action.transaction.amount.amount)}${
                action.kind === 'reverse'
                  ? '. Será criado um lançamento oposto vinculado, datado de hoje.'
                  : ''
              }`
            : undefined
        }
        confirmLabel="Confirmar"
        danger={action?.kind !== 'confirm'}
        requireReason={action?.kind !== 'confirm'}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          if (!action) {
            return;
          }

          const id = action.transaction.id;

          if (action.kind === 'confirm') {
            await api(`/finance/transactions/${id}/confirm`, { method: 'POST' });
          } else if (action.kind === 'cancel') {
            await api(`/finance/transactions/${id}/cancel`, { method: 'POST', body: { reason } });
          } else {
            await api(`/finance/transactions/${id}/reverse`, {
              method: 'POST',
              headers: reverseKey.headers(),
              body: { reason }
            });
            reverseKey.rotate();
          }

          await refresh('Lançamento atualizado.');
        }}
      />
    </>
  );
}
