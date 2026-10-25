'use client';

import { FIELD_LIMITS } from '@fenix/validation';
import { useState } from 'react';

import { ageFrom } from '../lib/age';
import { type AthleteDetail, GENDER, POSITIONS } from '../lib/sports-types';
import {
  CpfField,
  ErrorSummary,
  PhoneField,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from './ui';

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

function documentHint(source: Partial<AthleteDetail> | undefined): string {
  if (source?.documentNeedsReview) {
    return `Documento atual (${source.documentNumberMasked ?? '—'}) não é um CPF válido. Informe o CPF para corrigir.`;
  }

  return source?.documentNumberMasked
    ? `Atual: ${source.documentNumberMasked}. Preencha só para alterar.`
    : 'Opcional. Guardado cifrado; RG não é aceito.';
}

/**
 * Formulário de atleta (RF-008/RF-009, docs/29 COR-016). Em edição envia apenas campos
 * alterados, para que o histórico registre somente mudanças reais. CPF e telefones vêm
 * dos campos com máscara já como dígitos, o mesmo formato gravado pela API.
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
  const setValue = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form className="form" onSubmit={(event) => void action.submit(event)} noValidate>
      <ErrorSummary error={action.error} />
      {action.message ? <div className="alert alert-success">{action.message}</div> : null}

      <fieldset className="form-section">
        <legend>Identificação</legend>
        <div className="form-grid">
          <TextField
            label="Nome completo"
            required
            autoComplete="name"
            maxLength={FIELD_LIMITS.personName}
            value={form.fullName}
            onChange={set('fullName')}
            error={action.fieldError('fullName')}
          />
          <TextField
            label="Apelido / nome de quadra"
            maxLength={FIELD_LIMITS.shortName}
            value={form.preferredName}
            onChange={set('preferredName')}
            error={action.fieldError('preferredName')}
          />
          <TextField
            label="Data de nascimento"
            type="date"
            value={form.birthDate}
            onChange={set('birthDate')}
            error={action.fieldError('birthDate')}
          />
          <CpfField
            label="CPF"
            value={form.documentNumber}
            onValueChange={setValue('documentNumber')}
            hint={documentHint(source)}
            error={action.fieldError('documentNumber')}
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
              ...[...new Set([...POSITIONS, ...(form.position ? [form.position] : [])])].map(
                (p) => ({ value: p, label: p })
              )
            ]}
          />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Contato</legend>
        <div className="form-grid">
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            maxLength={FIELD_LIMITS.email}
            value={form.email}
            onChange={set('email')}
            error={action.fieldError('email')}
          />
          <PhoneField
            label="Celular"
            value={form.phone}
            onValueChange={setValue('phone')}
            error={action.fieldError('phone')}
          />
        </div>
      </fieldset>

      {isMinor ? (
        <fieldset className="form-section card" aria-describedby="guardian-note">
          <legend>Responsável (menor de 18 anos)</legend>
          <p id="guardian-note" className="muted" style={{ margin: 0 }}>
            Obrigatório para atletas menores de idade.
          </p>
          <div className="form-grid">
            <TextField
              label="Nome do responsável"
              required
              maxLength={FIELD_LIMITS.personName}
              value={form.guardianName}
              onChange={set('guardianName')}
              error={action.fieldError('guardianName')}
            />
            <PhoneField
              label="Celular do responsável"
              required
              value={form.guardianPhone}
              onValueChange={setValue('guardianPhone')}
              error={action.fieldError('guardianPhone')}
            />
          </div>
          {needsAck ? (
            <label className="checkbox">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                Confirmo que o responsável legal está ciente e autorizou o cadastro (menor de 12
                anos).
              </span>
            </label>
          ) : null}
          {action.fieldError('guardianAcknowledged') ? (
            <span className="field-error">{action.fieldError('guardianAcknowledged')}</span>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="form-section">
        <legend>Emergência</legend>
        <div className="form-grid">
          <TextField
            label="Contato de emergência"
            maxLength={FIELD_LIMITS.personName}
            value={form.emergencyContactName}
            onChange={set('emergencyContactName')}
            error={action.fieldError('emergencyContactName')}
          />
          <PhoneField
            label="Telefone de emergência"
            allowLandline
            value={form.emergencyContactPhone}
            onValueChange={setValue('emergencyContactPhone')}
            error={action.fieldError('emergencyContactPhone')}
          />
        </div>
      </fieldset>

      <TextArea
        label="Observações internas"
        maxLength={FIELD_LIMITS.notes}
        value={form.notes}
        onChange={set('notes')}
        hint="Não registre dados de saúde."
        error={action.fieldError('notes')}
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
