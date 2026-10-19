'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { ageFrom } from '../lib/age';
import { GENDER, POSITIONS } from '../lib/sports-types';
import { ErrorSummary, SelectField, TextArea, TextField, useSubmit } from './ui';

export interface ApplicantPayload {
  fullName: string;
  birthDate: string;
  email: string;
  phone: string;
  gender?: string;
  desiredPosition?: string;
  experience?: string;
  notes?: string;
  guardianName?: string;
  guardianPhone?: string;
  privacyConsent: boolean;
}

/**
 * Formulário público de interesse/inscrição com coleta mínima (RF-003/RF-004, DT-026):
 * responsável aparece somente para menores; menores de 12 são orientados a procurar a diretoria.
 */
export function ApplicantForm({
  submitLabel,
  extraField,
  onSubmit,
  intro
}: {
  readonly submitLabel: string;
  readonly extraField: 'experience' | 'notes';
  readonly onSubmit: (payload: ApplicantPayload) => Promise<void>;
  readonly intro?: ReactNode;
}) {
  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    email: '',
    phone: '',
    gender: '',
    desiredPosition: '',
    extra: '',
    guardianName: '',
    guardianPhone: ''
  });
  const [consent, setConsent] = useState(false);
  const age = form.birthDate ? ageFrom(form.birthDate) : null;
  const isMinor = age !== null && age < 18;
  const isChild = age !== null && age < 12;
  const action = useSubmit(async () => {
    const payload: ApplicantPayload = {
      fullName: form.fullName,
      birthDate: form.birthDate,
      email: form.email,
      phone: form.phone,
      privacyConsent: consent,
      ...(form.gender ? { gender: form.gender } : {}),
      ...(form.desiredPosition ? { desiredPosition: form.desiredPosition } : {}),
      ...(form.extra ? { [extraField]: form.extra } : {}),
      ...(isMinor ? { guardianName: form.guardianName, guardianPhone: form.guardianPhone } : {})
    };

    await onSubmit(payload);
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form className="form card" onSubmit={(event) => void action.submit(event)} noValidate>
      {intro}
      <ErrorSummary error={action.error} />
      <div className="form-grid">
        <TextField
          label="Nome completo"
          required
          autoComplete="name"
          value={form.fullName}
          onChange={set('fullName')}
          error={action.fieldError('fullName')}
        />
        <TextField
          label="Data de nascimento"
          type="date"
          required
          value={form.birthDate}
          onChange={set('birthDate')}
          error={action.fieldError('birthDate')}
        />
        <TextField
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={action.fieldError('email')}
        />
        <TextField
          label="Telefone/WhatsApp"
          type="tel"
          required
          autoComplete="tel"
          value={form.phone}
          onChange={set('phone')}
          error={action.fieldError('phone')}
        />
        <SelectField
          label="Gênero (opcional)"
          value={form.gender}
          onChange={set('gender')}
          options={[
            { value: '', label: 'Selecione' },
            ...Object.entries(GENDER).map(([value, label]) => ({ value, label }))
          ]}
        />
        <SelectField
          label="Posição desejada (opcional)"
          value={form.desiredPosition}
          onChange={set('desiredPosition')}
          options={[
            { value: '', label: 'Selecione' },
            ...POSITIONS.map((p) => ({ value: p, label: p }))
          ]}
        />
      </div>

      {isChild ? (
        <div className="alert alert-warning" role="status">
          Para menores de 12 anos, a inscrição é feita pelo responsável diretamente com a diretoria
          do time. <Link href="/contato">Ver contatos</Link>.
        </div>
      ) : null}

      {isMinor && !isChild ? (
        <fieldset className="form-grid" style={{ border: 0, padding: 0 }}>
          <legend className="label" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            Responsável (obrigatório para menores de 18 anos)
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

      <TextArea
        label={
          extraField === 'experience' ? 'Experiência no vôlei (opcional)' : 'Observações (opcional)'
        }
        value={form.extra}
        onChange={set('extra')}
        maxLength={2000}
      />

      <label className="checkbox">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Concordo que o Fênix use estes dados somente para contato e análise desta inscrição,
          conforme a <Link href="/privacidade">política de privacidade</Link>.
        </span>
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending || isChild}>
          {action.pending ? 'Enviando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
