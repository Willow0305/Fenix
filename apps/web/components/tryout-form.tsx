'use client';

import { useState } from 'react';

import type { Team, Tryout } from '../lib/sports-types';
import { ErrorSummary, SelectField, TextArea, TextField, useSubmit } from './ui';
import { teamOptions } from '../lib/team-options';

/** Converte ISO UTC para valor de `datetime-local` no fuso do navegador e vice-versa. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export interface TryoutPayload {
  title: string;
  description?: string;
  location?: string;
  teamId?: string;
  startsAt?: string;
  registrationStartsAt?: string;
  registrationEndsAt?: string;
  maxSlots?: number;
}

export function TryoutForm({
  source,
  teams,
  submitLabel,
  onSubmit
}: {
  readonly source?: Tryout | undefined;
  readonly teams: readonly Team[];
  readonly submitLabel: string;
  readonly onSubmit: (payload: TryoutPayload) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: source?.title ?? '',
    description: source?.description ?? '',
    location: source?.location ?? '',
    teamId: source?.team?.id ?? '',
    startsAt: toLocalInput(source?.startsAt),
    registrationStartsAt: toLocalInput(source?.registrationStartsAt),
    registrationEndsAt: toLocalInput(source?.registrationEndsAt),
    maxSlots: source?.maxSlots ? String(source.maxSlots) : ''
  });
  const action = useSubmit(async () => {
    const payload: TryoutPayload = { title: form.title };
    const optional = {
      description: form.description || undefined,
      location: form.location || undefined,
      teamId: form.teamId || undefined,
      startsAt: fromLocalInput(form.startsAt),
      registrationStartsAt: fromLocalInput(form.registrationStartsAt),
      registrationEndsAt: fromLocalInput(form.registrationEndsAt),
      maxSlots: form.maxSlots ? Number(form.maxSlots) : undefined
    };

    for (const [key, value] of Object.entries(optional)) {
      if (value !== undefined) {
        (payload as unknown as Record<string, unknown>)[key] = value;
      }
    }

    await onSubmit(payload);
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form className="form" onSubmit={(event) => void action.submit(event)}>
      <ErrorSummary error={action.error} />
      <div className="form-grid">
        <TextField
          label="Título"
          maxLength={160}
          required
          value={form.title}
          onChange={set('title')}
        />
        <SelectField
          label="Equipe"
          value={form.teamId}
          onChange={set('teamId')}
          options={[
            { value: '', label: 'Geral' },
            ...teamOptions(teams, 'pick', source?.team?.id ?? null)
          ]}
        />
        <TextField label="Local" maxLength={220} value={form.location} onChange={set('location')} />
        <TextField
          label="Data e hora da seletiva"
          type="datetime-local"
          value={form.startsAt}
          onChange={set('startsAt')}
        />
        <TextField
          label="Inscrições a partir de"
          type="datetime-local"
          value={form.registrationStartsAt}
          onChange={set('registrationStartsAt')}
        />
        <TextField
          label="Inscrições até"
          type="datetime-local"
          value={form.registrationEndsAt}
          onChange={set('registrationEndsAt')}
        />
        <TextField
          label="Vagas (opcional)"
          type="number"
          min={1}
          value={form.maxSlots}
          onChange={set('maxSlots')}
        />
      </div>
      <TextArea
        label="Descrição pública"
        maxLength={8000}
        value={form.description}
        onChange={set('description')}
      />
      <p className="muted">Horários informados no fuso deste computador e armazenados em UTC.</p>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
