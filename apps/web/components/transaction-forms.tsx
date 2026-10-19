'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CostCenter } from '../lib/finance-types';
import { todayCivil } from '../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../lib/idempotency';
import { useResource } from '../lib/use-resource';
import { AccountSelect, CategorySelect, MethodSelect } from './finance-pickers';
import { ErrorSummary, SelectField, TextField, useSubmit } from './ui';

/** Lançamento manual de receita/despesa (RF-026). */
export function TransactionForm({ onDone }: { readonly onDone: () => void }) {
  const { can } = useAuth();
  const idem = useIdempotencyKey();
  const centers = useResource<CostCenter[]>('/finance/cost-centers');
  const [form, setForm] = useState({
    direction: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    accountId: '',
    categoryId: '',
    costCenterId: '',
    paymentMethodId: '',
    amount: '',
    occurredOn: todayCivil(),
    description: '',
    notes: '',
    confirmNow: true
  });
  const action = useSubmit(async () => {
    await api('/finance/transactions', {
      method: 'POST',
      headers: idem.headers(),
      body: {
        direction: form.direction,
        accountId: form.accountId,
        categoryId: form.categoryId,
        amount: normalizeAmount(form.amount),
        occurredOn: form.occurredOn,
        description: form.description,
        ...(form.costCenterId ? { costCenterId: form.costCenterId } : {}),
        ...(form.paymentMethodId ? { paymentMethodId: form.paymentMethodId } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
        confirmNow: form.confirmNow && can('transactions.confirm')
      }
    });
    idem.rotate();
    onDone();
  });

  return (
    <form className="form" onSubmit={(event) => void action.submit(event)}>
      <h2>Novo lançamento</h2>
      <ErrorSummary error={action.error} />
      <div className="row" role="radiogroup" aria-label="Tipo">
        {(['EXPENSE', 'INCOME'] as const).map((direction) => (
          <label key={direction} className="checkbox">
            <input
              type="radio"
              name="direction"
              checked={form.direction === direction}
              onChange={() => setForm({ ...form, direction, categoryId: '' })}
            />
            <span>{direction === 'INCOME' ? 'Entrada (receita)' : 'Saída (despesa)'}</span>
          </label>
        ))}
      </div>
      <div className="form-grid">
        <AccountSelect
          label="Conta"
          value={form.accountId}
          onChange={(v) => setForm({ ...form, accountId: v })}
        />
        <CategorySelect
          nature={form.direction}
          value={form.categoryId}
          onChange={(v) => setForm({ ...form, categoryId: v })}
        />
        <TextField
          label="Valor (R$)"
          required
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <TextField
          label="Data"
          type="date"
          required
          value={form.occurredOn}
          onChange={(e) => setForm({ ...form, occurredOn: e.target.value })}
        />
        <TextField
          label="Descrição"
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <SelectField
          label="Centro de custo (opcional)"
          value={form.costCenterId}
          onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}
          options={[
            { value: '', label: 'Nenhum' },
            ...(centers.data ?? [])
              .filter((c) => c.isActive)
              .map((c) => ({ value: c.id, label: c.name }))
          ]}
        />
        <MethodSelect
          required={false}
          value={form.paymentMethodId}
          onChange={(v) => setForm({ ...form, paymentMethodId: v })}
        />
        <TextField
          label="Observações"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      {can('transactions.confirm') ? (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.confirmNow}
            onChange={(e) => setForm({ ...form, confirmNow: e.target.checked })}
          />
          <span>Confirmar agora (entra no saldo imediatamente)</span>
        </label>
      ) : (
        <p className="muted">O lançamento ficará pendente até alguém com permissão confirmar.</p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Salvando…' : 'Registrar lançamento'}
        </button>
      </div>
    </form>
  );
}

/** Transferência entre contas (RCF-003). */
export function TransferForm({ onDone }: { readonly onDone: () => void }) {
  const idem = useIdempotencyKey();
  const [form, setForm] = useState({
    sourceAccountId: '',
    destinationAccountId: '',
    amount: '',
    occurredOn: todayCivil(),
    description: ''
  });
  const action = useSubmit(async () => {
    await api('/finance/transfers', {
      method: 'POST',
      headers: idem.headers(),
      body: {
        sourceAccountId: form.sourceAccountId,
        destinationAccountId: form.destinationAccountId,
        amount: normalizeAmount(form.amount),
        occurredOn: form.occurredOn,
        ...(form.description ? { description: form.description } : {})
      }
    });
    idem.rotate();
    onDone();
  });

  return (
    <form className="form" onSubmit={(event) => void action.submit(event)}>
      <h2>Transferência entre contas</h2>
      <p className="muted">
        Gera uma saída e uma entrada vinculadas; não conta como receita nem despesa.
      </p>
      <ErrorSummary error={action.error} />
      <div className="form-grid">
        <AccountSelect
          label="De"
          value={form.sourceAccountId}
          onChange={(v) => setForm({ ...form, sourceAccountId: v })}
        />
        <AccountSelect
          label="Para"
          value={form.destinationAccountId}
          onChange={(v) => setForm({ ...form, destinationAccountId: v })}
        />
        <TextField
          label="Valor (R$)"
          required
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <TextField
          label="Data"
          type="date"
          required
          value={form.occurredOn}
          onChange={(e) => setForm({ ...form, occurredOn: e.target.value })}
        />
        <TextField
          label="Descrição"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          Transferir
        </button>
      </div>
    </form>
  );
}
