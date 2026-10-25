'use client';

import { FIELD_LIMITS } from '@fenix/validation';
import { useState } from 'react';

import type { Plan } from '../lib/finance-types';
import { normalizeAmount } from '../lib/idempotency';
import { Icon } from './icon';
import { ErrorSummary, TextArea, TextField, useSubmit } from './ui';

export interface PlanPayload {
  name: string;
  amount: string;
  dueDay: number;
  description: string;
}

/**
 * Formulário único de plano de mensalidade, para criar e editar (docs/29 COR-021).
 * Mudar valor ou vencimento vale para as próximas cobranças geradas; as já geradas não mudam.
 */
export function PlanForm({
  source,
  submitLabel,
  onSubmit,
  onCancel
}: {
  readonly source?: Plan | undefined;
  readonly submitLabel: string;
  readonly onSubmit: (payload: PlanPayload) => Promise<void>;
  readonly onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    name: source?.name ?? '',
    amount: source ? source.amount.amount.replace('.', ',') : '',
    dueDay: String(source?.dueDay ?? 10),
    description: source?.description ?? ''
  });
  const save = useSubmit(async () => {
    await onSubmit({
      name: form.name.trim(),
      amount: normalizeAmount(form.amount),
      dueDay: Number(form.dueDay),
      description: form.description.trim()
    });
  });

  return (
    <form className="form" onSubmit={(event) => void save.submit(event)}>
      <ErrorSummary error={save.error} />
      <div className="form-grid">
        <TextField
          label="Nome"
          maxLength={FIELD_LIMITS.shortName}
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={save.fieldError('name')}
        />
        <TextField
          label="Valor (R$)"
          maxLength={16}
          required
          inputMode="decimal"
          placeholder="80,00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          error={save.fieldError('amount')}
        />
        <TextField
          label="Dia de vencimento"
          type="number"
          min={1}
          max={31}
          required
          value={form.dueDay}
          onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
          hint="Dia do mês em que a cobrança vence. Em meses mais curtos, vence no último dia."
          error={save.fieldError('dueDay')}
        />
      </div>
      <TextArea
        label="Descrição"
        maxLength={FIELD_LIMITS.description}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        hint="Ex.: quem se encaixa neste plano, o que inclui."
      />
      {source ? (
        <p className="muted" style={{ margin: 0 }}>
          Mudanças de valor e vencimento valem para as próximas cobranças geradas. Para mudar uma
          cobrança já gerada, use o detalhe da mensalidade.
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          <Icon name="check-lg" /> {save.pending ? 'Salvando…' : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
