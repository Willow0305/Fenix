'use client';

import { useState } from 'react';

import { AccountSelect } from '../../../../components/finance-pickers';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import type { Closing, ClosingPreview } from '../../../../lib/finance-types';
import { formatDate, formatDateTime, formatMoney, todayCivil } from '../../../../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../../../../lib/idempotency';
import { useResource } from '../../../../lib/use-resource';

export default function ClosingsPage() {
  const { can } = useAuth();
  const idem = useIdempotencyKey();
  const closings = useResource<Closing[]>('/finance/closings');
  const [form, setForm] = useState({
    accountId: '',
    periodStart: `${todayCivil().slice(0, 7)}-01`,
    periodEnd: todayCivil(),
    countedBalance: '',
    notes: ''
  });
  const [preview, setPreview] = useState<ClosingPreview | null>(null);
  const [reopening, setReopening] = useState<Closing | null>(null);
  const check = useSubmit(async () => {
    setPreview(
      await api<ClosingPreview>('/finance/closings/preview', {
        query: {
          accountId: form.accountId,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd
        }
      })
    );
  });
  const close = useSubmit(async () => {
    await api('/finance/closings', {
      method: 'POST',
      headers: idem.headers(),
      body: {
        ...form,
        countedBalance: normalizeAmount(form.countedBalance),
        ...(form.notes ? {} : { notes: undefined })
      }
    });
    idem.rotate();
    setPreview(null);
    close.setMessage('Caixa fechado. Lançamentos do período ficam bloqueados.');
    await closings.reload();
  });

  return (
    <>
      <PageHeader
        title="Conferência e fechamento"
        description="Compare o saldo esperado com o valor contado/extrato e feche o período. Reabrir exige permissão e motivo."
      />
      {can('cash.reconcile') ? (
        <section className="card stack">
          <h2>Conferir período</h2>
          <form className="form" onSubmit={(event) => void check.submit(event)}>
            <ErrorSummary error={check.error} />
            <div className="form-grid">
              <AccountSelect
                label="Conta"
                value={form.accountId}
                onChange={(v) => {
                  setPreview(null);
                  setForm({ ...form, accountId: v });
                }}
              />
              <TextField
                label="Início"
                type="date"
                value={form.periodStart}
                onChange={(e) => {
                  setPreview(null);
                  setForm({ ...form, periodStart: e.target.value });
                }}
              />
              <TextField
                label="Fim"
                type="date"
                value={form.periodEnd}
                onChange={(e) => {
                  setPreview(null);
                  setForm({ ...form, periodEnd: e.target.value });
                }}
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!form.accountId || check.pending}
              >
                Calcular saldo esperado
              </button>
            </div>
          </form>
          {preview ? (
            <div className="stack">
              <dl className="stat-grid" style={{ margin: 0 }}>
                <div className="stat">
                  <dt className="stat-label">Saldo anterior</dt>
                  <dd className="stat-value" style={{ margin: 0 }}>
                    {formatMoney(preview.openingBalance.amount)}
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Entradas</dt>
                  <dd className="stat-value" style={{ margin: 0 }}>
                    {formatMoney(preview.income.amount)}
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Saídas</dt>
                  <dd className="stat-value" style={{ margin: 0 }}>
                    {formatMoney(preview.expense.amount)}
                  </dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Saldo esperado</dt>
                  <dd className="stat-value" style={{ margin: 0 }}>
                    {formatMoney(preview.expectedBalance.amount)}
                  </dd>
                </div>
              </dl>
              {preview.pendingTransactions > 0 ? (
                <Alert kind="warning">
                  Há {preview.pendingTransactions} lançamento(s) pendente(s) no período. Confirme ou
                  cancele antes de fechar.
                </Alert>
              ) : null}
              {can('cash.close') ? (
                <form className="form" onSubmit={(event) => void close.submit(event)}>
                  <ErrorSummary error={close.error} />
                  <div className="form-grid">
                    <TextField
                      label="Saldo contado / extrato (R$)"
                      maxLength={16}
                      required
                      numeric="decimal"
                      value={form.countedBalance}
                      onChange={(e) => setForm({ ...form, countedBalance: e.target.value })}
                    />
                    <TextField
                      label="Observação"
                      maxLength={2000}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      hint="Explique eventuais diferenças."
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={close.pending || preview.pendingTransactions > 0}
                    >
                      Fechar caixa do período
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
          {close.message ? <Alert kind="success">{close.message}</Alert> : null}
        </section>
      ) : null}

      <section className="stack" aria-labelledby="historico">
        <h2 id="historico">Histórico de fechamentos</h2>
        {closings.error ? <Alert kind="error">{closings.error}</Alert> : null}
        {closings.data?.length === 0 ? <Empty>Nenhum fechamento registrado.</Empty> : null}
        {closings.data && closings.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Conta</th>
                  <th scope="col">Período</th>
                  <th scope="col" className="num">
                    Esperado
                  </th>
                  <th scope="col" className="num">
                    Contado
                  </th>
                  <th scope="col" className="num">
                    Diferença
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {closings.data.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Conta">{c.account.name}</td>
                    <td data-label="Período">
                      {formatDate(c.periodStart)} a {formatDate(c.periodEnd)}
                    </td>
                    <td data-label="Esperado" className="num">
                      {formatMoney(c.expectedBalance.amount)}
                    </td>
                    <td data-label="Contado" className="num">
                      {formatMoney(c.countedBalance.amount)}
                    </td>
                    <td
                      className="num"
                      style={{
                        color:
                          c.differenceAmount.amount === '0.00' ? undefined : 'var(--color-danger)'
                      }}
                    >
                      {formatMoney(c.differenceAmount.amount)}
                    </td>
                    <td data-label="Diferença">
                      {c.status === 'CLOSED' ? (
                        <>
                          <span className="badge badge-success">Fechado</span>
                          <div className="muted" style={{ fontSize: '0.8rem' }}>
                            por {c.closedBy} em {formatDateTime(c.closedAt)}
                          </div>
                          {can('cash.reopen') ? (
                            <button
                              type="button"
                              className="btn btn-link"
                              onClick={() => setReopening(c)}
                            >
                              Reabrir
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="badge badge-warning">Reaberto</span>
                          <div className="muted" style={{ fontSize: '0.8rem' }}>
                            {c.reopenedBy}: {c.reopeningReason}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={reopening !== null}
        title="Reabrir fechamento"
        description="Lançamentos do período voltam a ser permitidos. O fechamento anterior fica registrado na auditoria."
        confirmLabel="Reabrir"
        danger
        requireReason
        onClose={() => setReopening(null)}
        onConfirm={async (reason) => {
          await api(`/finance/closings/${reopening?.id ?? ''}/reopen`, {
            method: 'POST',
            body: { reason }
          });
          await closings.reload();
        }}
      />
    </>
  );
}
