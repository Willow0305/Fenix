'use client';

import { useState } from 'react';

import {
  Alert,
  ErrorSummary,
  Loading,
  PageHeader,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import type { Plan } from '../../../lib/finance-types';
import { formatMoney } from '../../../lib/format';
import { normalizeAmount } from '../../../lib/idempotency';
import { useResource } from '../../../lib/use-resource';

export default function PlansPage() {
  const { can } = useAuth();
  const plans = useResource<Plan[]>('/fee-plans');
  const [form, setForm] = useState({ name: '', amount: '', dueDay: '10', description: '' });
  const [editing, setEditing] = useState<Plan | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const manage = can('fees.plans.manage');

  const create = useSubmit(async () => {
    await api('/fee-plans', {
      method: 'POST',
      body: {
        name: form.name,
        amount: normalizeAmount(form.amount),
        dueDay: Number(form.dueDay),
        ...(form.description ? { description: form.description } : {})
      }
    });
    setForm({ name: '', amount: '', dueDay: '10', description: '' });
    create.setMessage('Plano criado.');
    await plans.reload();
  });
  const update = useSubmit(async () => {
    if (!editing) {
      return;
    }

    await api(`/fee-plans/${editing.id}`, {
      method: 'PATCH',
      body: { amount: normalizeAmount(editAmount) }
    });
    setEditing(null);
    await plans.reload();
  });

  async function toggle(plan: Plan) {
    await api(`/fee-plans/${plan.id}`, {
      method: 'PATCH',
      body: { status: plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
    });
    await plans.reload();
  }

  return (
    <>
      <PageHeader
        title="Planos de mensalidade"
        description="Alterar ou inativar um plano não muda as cobranças já geradas."
      />
      {plans.error ? <Alert kind="error">{plans.error}</Alert> : null}
      {plans.loading && !plans.data ? <Loading /> : null}
      {plans.data && plans.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Plano</th>
                <th scope="col" className="num">
                  Valor
                </th>
                <th scope="col">Vencimento</th>
                <th scope="col" className="num">
                  Atletas
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {plans.data.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <strong>{plan.name}</strong>
                    {plan.description ? <div className="muted">{plan.description}</div> : null}
                  </td>
                  <td className="num">
                    {editing?.id === plan.id ? (
                      <form className="row" onSubmit={(e) => void update.submit(e)}>
                        <input
                          aria-label="Novo valor"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          style={{ width: 110 }}
                        />
                        <button type="submit" className="btn btn-primary btn-sm">
                          Salvar
                        </button>
                      </form>
                    ) : (
                      <>
                        {formatMoney(plan.amount.amount)}{' '}
                        {manage ? (
                          <button
                            type="button"
                            className="btn btn-link"
                            onClick={() => {
                              setEditing(plan);
                              setEditAmount(plan.amount.amount);
                            }}
                          >
                            Alterar
                          </button>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td>Dia {plan.dueDay}</td>
                  <td className="num">{plan.activeAthletes}</td>
                  <td>
                    <span className={`badge ${plan.status === 'ACTIVE' ? 'badge-success' : ''}`}>
                      {plan.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>{' '}
                    {manage ? (
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => void toggle(plan)}
                      >
                        {plan.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : plans.data ? (
        <p className="muted">Nenhum plano cadastrado.</p>
      ) : null}
      <ErrorSummary error={update.error} />
      {manage ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <h2>Novo plano</h2>
          {create.message ? <Alert kind="success">{create.message}</Alert> : null}
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <TextField
              label="Nome"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Valor (R$)"
              required
              inputMode="decimal"
              placeholder="80,00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <TextField
              label="Dia de vencimento"
              type="number"
              min={1}
              max={31}
              required
              value={form.dueDay}
              onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
              hint="Em meses mais curtos, vence no último dia."
            />
            <TextField
              label="Descrição"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Criar plano
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
