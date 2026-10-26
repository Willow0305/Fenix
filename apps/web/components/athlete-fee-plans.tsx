'use client';

import Link from 'next/link';
import { useState } from 'react';

import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { type AthletePlan, FEE_STATUS, type Fee, type Plan } from '../lib/finance-types';
import type { Page } from '../lib/api-types';
import { formatDate, formatMoney, formatMonth, todayCivil } from '../lib/format';
import { normalizeAmount } from '../lib/idempotency';
import { useResource } from '../lib/use-resource';
import { ConfirmDialog, ErrorSummary, SelectField, TextField, useSubmit } from './ui';

/** Plano vigente, histórico de planos e mensalidades do atleta (RF-011/RF-012). */
export function AthleteFeePlans({ athleteId }: { readonly athleteId: string }) {
  const { can } = useAuth();
  const links = useResource<AthletePlan[]>(`/athletes/${athleteId}/fee-plans`);
  const plans = useResource<Plan[]>('/fee-plans');
  const fees = useResource<Page<Fee>>('/monthly-fees', { athleteId, pageSize: 12 });
  const [form, setForm] = useState({
    planId: '',
    startsOn: todayCivil(),
    amountOverride: '',
    reason: ''
  });
  const [ending, setEnding] = useState<AthletePlan | null>(null);
  const [endsOn, setEndsOn] = useState(todayCivil());
  const current = links.data?.find((link) => link.status === 'ACTIVE' && !link.endsOn);
  const assign = useSubmit(async () => {
    links.setData(
      await api<AthletePlan[]>(`/athletes/${athleteId}/fee-plans`, {
        method: 'POST',
        body: {
          planId: form.planId,
          startsOn: form.startsOn,
          ...(form.amountOverride ? { amountOverride: normalizeAmount(form.amountOverride) } : {}),
          ...(form.reason ? { reason: form.reason } : {})
        }
      })
    );
  });

  return (
    <section className="card stack" aria-labelledby="plano">
      <h2 id="plano">Mensalidade</h2>
      {current ? (
        <div className="row">
          <span>
            Plano{' '}
            <Link href={`/admin/planos/${current.plan.id}`}>
              <strong>{current.plan.name}</strong>
            </Link>{' '}
            desde {formatDate(current.startsOn)} · {formatMoney(current.effectiveAmount.amount)}
            {current.amountOverride ? ' (valor individual)' : ''}
          </span>
          {can('fees.plans.manage') ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEnding(current)}
            >
              Encerrar plano
            </button>
          ) : null}
        </div>
      ) : (
        <p className="muted">Sem plano vigente — nenhuma mensalidade será gerada.</p>
      )}
      {!current && can('fees.plans.manage') ? (
        <form className="form" onSubmit={(event) => void assign.submit(event)}>
          <ErrorSummary error={assign.error} />
          <div className="form-grid">
            <SelectField
              label="Plano"
              required
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
              options={[
                { value: '', label: 'Selecione' },
                ...(plans.data ?? [])
                  .filter((p) => p.status === 'ACTIVE')
                  .map((p) => ({
                    value: p.id,
                    label: `${p.name} — ${formatMoney(p.amount.amount)}`
                  }))
              ]}
            />
            <TextField
              label="Início"
              type="date"
              required
              value={form.startsOn}
              onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
            />
            <TextField
              label="Valor individual (opcional)"
              maxLength={16}
              numeric="decimal"
              value={form.amountOverride}
              onChange={(e) => setForm({ ...form, amountOverride: e.target.value })}
              hint="Para bolsa ou desconto permanente."
            />
            <TextField
              label="Motivo do valor individual"
              maxLength={1000}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!form.planId || assign.pending}
            >
              Atribuir plano
            </button>
          </div>
        </form>
      ) : null}
      {fees.data && fees.data.data.length > 0 ? (
        <details>
          <summary>Últimas mensalidades</summary>
          <ul>
            {fees.data.data.map((fee) => (
              <li key={fee.id}>
                <Link href={`/admin/mensalidades/${fee.id}`}>
                  {formatMonth(fee.referenceMonth)}
                </Link>{' '}
                — {formatMoney(fee.totalAmount.amount)}{' '}
                <span className={`badge ${FEE_STATUS[fee.status].badge}`}>
                  {FEE_STATUS[fee.status].label}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <ConfirmDialog
        open={ending !== null}
        title="Encerrar plano"
        description="Mensalidades de meses posteriores ao término não serão geradas."
        confirmLabel="Encerrar"
        requireReason
        onClose={() => setEnding(null)}
        onConfirm={async (reason) => {
          links.setData(
            await api<AthletePlan[]>(`/athletes/${athleteId}/fee-plans/${ending?.id ?? ''}/end`, {
              method: 'POST',
              body: { endsOn, reason }
            })
          );
        }}
      >
        <TextField
          label="Data de término"
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      </ConfirmDialog>
    </section>
  );
}
