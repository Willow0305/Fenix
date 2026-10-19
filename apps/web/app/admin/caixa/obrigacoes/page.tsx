'use client';

import { useState } from 'react';

import { AccountSelect, CategorySelect } from '../../../../components/finance-pickers';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  SelectField,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import {
  type MoneyView,
  OBLIGATION_STATUS,
  type Obligation,
  type ObligationStatus,
  type ObligationType
} from '../../../../lib/finance-types';
import { formatDate, formatMoney, todayCivil } from '../../../../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../../../../lib/idempotency';
import { useResource } from '../../../../lib/use-resource';

type ObligationPage = Page<Obligation> & { totals: { open: MoneyView } };

export default function ObligationsPage() {
  const { can } = useAuth();
  const idem = useIdempotencyKey();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<ObligationType | ''>('');
  const [status, setStatus] = useState<ObligationStatus | ''>('OPEN');
  const list = useResource<ObligationPage>('/finance/obligations', {
    page,
    pageSize: 30,
    type,
    status
  });
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState<Obligation | null>(null);
  const [cancelling, setCancelling] = useState<Obligation | null>(null);
  const [settle, setSettle] = useState({ accountId: '', paidOn: todayCivil() });
  const [form, setForm] = useState({
    type: 'PAYABLE' as ObligationType,
    categoryId: '',
    counterpartyName: '',
    description: '',
    competenceDate: todayCivil(),
    dueDate: todayCivil(),
    amount: ''
  });
  const create = useSubmit(async () => {
    await api('/finance/obligations', {
      method: 'POST',
      headers: idem.headers(),
      body: { ...form, amount: normalizeAmount(form.amount) }
    });
    idem.rotate();
    setCreating(false);
    setForm({ ...form, counterpartyName: '', description: '', amount: '' });
    await list.reload();
  });

  return (
    <>
      <PageHeader
        title="Contas a pagar e a receber"
        description="Obrigações com vencimento. A quitação gera o lançamento no Caixa."
        actions={
          can('transactions.create') ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating((v) => !v)}
            >
              {creating ? 'Fechar' : 'Nova conta'}
            </button>
          ) : null
        }
      />
      {creating ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <SelectField
              label="Tipo"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as ObligationType, categoryId: '' })
              }
              options={[
                { value: 'PAYABLE', label: 'A pagar' },
                { value: 'RECEIVABLE', label: 'A receber' }
              ]}
            />
            <CategorySelect
              nature={form.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME'}
              value={form.categoryId}
              onChange={(v) => setForm({ ...form, categoryId: v })}
            />
            <TextField
              label={form.type === 'PAYABLE' ? 'Fornecedor / favorecido' : 'Pagador'}
              required
              value={form.counterpartyName}
              onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
            />
            <TextField
              label="Descrição"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              label="Competência"
              type="date"
              required
              value={form.competenceDate}
              onChange={(e) => setForm({ ...form, competenceDate: e.target.value })}
            />
            <TextField
              label="Vencimento"
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <TextField
              label="Valor (R$)"
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Salvar conta
            </button>
          </div>
        </form>
      ) : null}
      <div className="row">
        <label className="field">
          <span className="label">Tipo</span>
          <select
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value as ObligationType | '');
            }}
          >
            <option value="">Todas</option>
            <option value="PAYABLE">A pagar</option>
            <option value="RECEIVABLE">A receber</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ObligationStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(OBLIGATION_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        {list.data ? (
          <span className="muted">
            Em aberto nos filtros: {formatMoney(list.data.totals.open.amount)}
          </span>
        ) : null}
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhuma conta para os filtros.</Empty> : null}
      {list.data && list.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Vencimento</th>
                <th scope="col">Descrição</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">
                  Valor
                </th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((o) => (
                <tr key={o.id}>
                  <td>{formatDate(o.dueDate)}</td>
                  <td>
                    {o.description}
                    <div className="muted">
                      {o.counterpartyName} · {o.category.name}
                    </div>
                  </td>
                  <td>{o.type === 'PAYABLE' ? 'A pagar' : 'A receber'}</td>
                  <td className="num">{formatMoney(o.amount.amount)}</td>
                  <td>
                    <span className={`badge ${OBLIGATION_STATUS[o.status].badge}`}>
                      {OBLIGATION_STATUS[o.status].label}
                    </span>
                  </td>
                  <td>
                    {(o.status === 'OPEN' || o.status === 'OVERDUE') &&
                    can('transactions.confirm') ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setSettling(o)}
                      >
                        Quitar
                      </button>
                    ) : null}{' '}
                    {(o.status === 'OPEN' || o.status === 'OVERDUE') &&
                    can('transactions.cancel') ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCancelling(o)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {list.data ? <Pagination {...list.data.meta} onChange={setPage} /> : null}

      <ConfirmDialog
        open={settling !== null}
        title={settling?.type === 'PAYABLE' ? 'Registrar pagamento' : 'Registrar recebimento'}
        description={`${settling?.description ?? ''} — ${formatMoney(settling?.amount.amount)}`}
        confirmLabel="Quitar"
        onClose={() => setSettling(null)}
        onConfirm={async () => {
          await api(`/finance/obligations/${settling?.id ?? ''}/settle`, {
            method: 'POST',
            body: settle
          });
          await list.reload();
        }}
      >
        <AccountSelect
          label="Conta"
          value={settle.accountId}
          onChange={(v) => setSettle({ ...settle, accountId: v })}
        />
        <TextField
          label="Data"
          type="date"
          value={settle.paidOn}
          onChange={(e) => setSettle({ ...settle, paidOn: e.target.value })}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar conta"
        confirmLabel="Cancelar conta"
        danger
        requireReason
        onClose={() => setCancelling(null)}
        onConfirm={async (reason) => {
          await api(`/finance/obligations/${cancelling?.id ?? ''}/cancel`, {
            method: 'POST',
            body: { reason }
          });
          await list.reload();
        }}
      />
    </>
  );
}
