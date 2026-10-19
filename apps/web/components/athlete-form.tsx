'use client';

import { useState } from 'react';

import { ageFrom } from '../lib/age';
import { type AthleteDetail, GENDER, POSITIONS } from '../lib/sports-types';
import { ErrorSummary, SelectField, TextArea, TextField, useSubmit } from './ui';

export interface AthletePayload {
  fullName: string;
  preferredName?: string;
  birthDate?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  gender?: string;
  position?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianAcknowledged?: boolean;
  notes?: string;
}

type FormState = Record<Exclude<keyof AthletePayload, 'guardianAcknowledged'>, string>;

function initial(source?: Partial<AthleteDetail> & { desiredPosition?: string | null }): FormState {
  return {
    fullName: source?.fullName ?? '',
    preferredName: source?.preferredName ?? '',
    birthDate: source?.birthDate ?? '',
    documentNumber: '',
    email: source?.email ?? '',
    phone: source?.phone ?? '',
    gender: source?.gender ?? '',
    position: source?.position ?? source?.desiredPosition ?? '',
    emergencyContactName: source?.emergencyContactName ?? '',
    emergencyContactPhone: source?.emergencyContactPhone ?? '',
    guardianName: source?.guardianName ?? '',
    guardianPhone: source?.guardianPhone ?? '',
    notes: source?.notes ?? ''
  };
}

/**
 * Formulário de atleta (RF-008/RF-009). Em edição envia apenas campos alterados,
 * para que o histórico registre somente mudanças reais.
 */
export function AthleteForm({
  source,
  mode,
  submitLabel,
  onSubmit
}: {
  readonly source?: (Partial<AthleteDetail> & { desiredPosition?: string | null }) | undefined;
  readonly mode: 'create' | 'edit';
  readonly submitLabel: string;
  readonly onSubmit: (payload: AthletePayload) => Promise<void>;
}) {
  const start = initial(source);
  const [form, setForm] = useState<FormState>(start);
  const [ack, setAck] = useState(false);
  const age = form.birthDate ? ageFrom(form.birthDate) : null;
  const isMinor = age !== null && age < 18;
  const needsAck = age !== null && age < 12 && !source?.guardianAcknowledgedAt;
  const action = useSubmit(async () => {
    const entries = Object.entries(form) as [keyof FormState, string][];
    const changed = entries.filter(([key, value]) =>
      mode === 'create'
        ? value.trim() !== ''
        : key === 'documentNumber'
          ? value.trim() !== ''
          : value !== start[key]
    );
    const payload = Object.fromEntries(changed) as unknown as AthletePayload;

    if (mode === 'create') {
      payload.fullName = form.fullName;
    }

    if (needsAck && ack) {
      payload.guardianAcknowledged = true;
    }

    await onSubmit(payload);
  });
  const set = (key: keyof FormState) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form className="form" onSubmit={(event) => void action.submit(event)} noValidate>
      <ErrorSummary error={action.error} />
      {action.message ? <div className="alert alert-success">{action.message}</div> : null}
      <div className="form-grid">
        <TextField
          label="Nome completo"
          required
          value={form.fullName}
          onChange={set('fullName')}
          error={action.fieldError('fullName')}
        />
        <TextField
          label="Apelido / nome de quadra"
          value={form.preferredName}
          onChange={set('preferredName')}
        />
        <TextField
          label="Data de nascimento"
          type="date"
          value={form.birthDate}
          onChange={set('birthDate')}
          error={action.fieldError('birthDate')}
        />
        <TextField
          label="Documento (RG/CPF)"
          value={form.documentNumber}
          onChange={set('documentNumber')}
          hint={
            source?.documentNumberMasked
              ? `Atual: ${source.documentNumberMasked}. Preencha só para alterar.`
              : 'Armazenado cifrado.'
          }
        />
        <TextField
          label="E-mail"
          type="email"
          value={form.email}
          onChange={set('email')}
          error={action.fieldError('email')}
        />
        <TextField
          label="Telefone"
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          error={action.fieldError('phone')}
        />
        <SelectField
          label="Gênero"
          value={form.gender}
          onChange={set('gender')}
          options={[
            { value: '', label: 'Não informado' },
            ...Object.entries(GENDER).map(([value, label]) => ({ value, label }))
          ]}
        />
        <SelectField
          label="Posição"
          value={form.position}
          onChange={set('position')}
          options={[
            { value: '', label: 'Não definida' },
            ...[...new Set([...POSITIONS, ...(form.position ? [form.position] : [])])].map((p) => ({
              value: p,
              label: p
            }))
          ]}
        />
        <TextField
          label="Contato de emergência"
          value={form.emergencyContactName}
          onChange={set('emergencyContactName')}
        />
        <TextField
          label="Telefone de emergência"
          type="tel"
          value={form.emergencyContactPhone}
          onChange={set('emergencyContactPhone')}
          error={action.fieldError('emergencyContactPhone')}
        />
      </div>
      {isMinor ? (
        <fieldset className="form-grid" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            Responsável (menor de 18 anos)
          </legend>
          <TextField
            label="Nome do responsável"
            required
            value={form.guardianName}
            onChange={set('guardianName')}
            error={action.fieldError('guardianName')}
          />
          <TextField
            label="Telefone do responsável"
            type="tel"
            required
            value={form.guardianPhone}
            onChange={set('guardianPhone')}
            error={action.fieldError('guardianPhone')}
          />
        </fieldset>
      ) : null}
      {needsAck ? (
        <label className="checkbox">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>
            Confirmo que o responsável legal está ciente e autorizou o cadastro (menor de 12 anos).
          </span>
        </label>
      ) : null}
      {action.fieldError('guardianAcknowledged') ? (
        <span className="field-error">{action.fieldError('guardianAcknowledged')}</span>
      ) : null}
      <TextArea
        label="Observações internas"
        value={form.notes}
        onChange={set('notes')}
        hint="Não registre dados de saúde."
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
