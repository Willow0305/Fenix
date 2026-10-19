'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  TextArea,
  useSubmit
} from '../../../../../components/ui';
import { api } from '../../../../../lib/api-client';
import { useAuth } from '../../../../../lib/auth-context';
import { formatDateTime, formatMoney } from '../../../../../lib/format';
import type { Availability, PartnerService } from '../../../../../lib/partner-types';
import { useResource } from '../../../../../lib/use-resource';

interface Slots {
  service: PartnerService;
  slots: Availability[];
  notice: string;
}

/** Solicitação de atendimento: horário livre + observação sem dados de saúde (RN-PAR-008). */
export default function ServiceRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useAuth();
  const data = useResource<Slots>(`/public/partner-services/${id}/slots`);
  const [slotId, setSlotId] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const request = useSubmit(async () => {
    await api('/appointments', {
      method: 'POST',
      body: { serviceId: id, availabilityId: slotId, ...(notes.trim() ? { notes } : {}) }
    });
    setDone(true);
  });

  if (data.loading && !data.data) {
    return <Loading />;
  }

  if (data.error || !data.data) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <Alert kind="error">{data.error ?? 'Serviço não encontrado.'}</Alert>
      </div>
    );
  }

  const { service, slots, notice } = data.data;

  return (
    <div className="container stack" style={{ paddingTop: '2rem', maxWidth: '48rem' }}>
      <p>
        <Link href={`/parceiros/${service.partner.id}`}>← {service.partner.name}</Link>
      </p>
      <h1>{service.name}</h1>
      <p className="muted">
        {service.durationMinutes} min ·{' '}
        {service.price ? formatMoney(service.price.amount) : 'valor a combinar com o parceiro'}
        {service.professional ? ` · com ${service.professional.fullName}` : ''}
      </p>
      {service.description ? <p>{service.description}</p> : null}

      {done ? (
        <Alert kind="success">
          Solicitação enviada. Ela ainda não é uma confirmação: a diretoria vai confirmar ou sugerir
          outro horário. <Link href="/minha-conta/agendamentos">Acompanhar</Link>
        </Alert>
      ) : status !== 'authenticated' ? (
        <div className="card stack">
          <p>Para solicitar um horário, entre na sua conta.</p>
          <Link
            href={`/entrar?next=/parceiros/servicos/${id}`}
            className="btn btn-primary"
            style={{ justifySelf: 'start' }}
          >
            Entrar
          </Link>
        </div>
      ) : slots.length === 0 ? (
        <Empty>Nenhum horário livre no momento. Volte mais tarde.</Empty>
      ) : (
        <form className="form card" onSubmit={(event) => void request.submit(event)}>
          <ErrorSummary error={request.error} />
          <fieldset className="stack">
            <legend>Escolha um horário (fuso de Rio Branco)</legend>
            {slots.map((slot) => (
              <label key={slot.id} className="row">
                <input
                  type="radio"
                  name="slot"
                  value={slot.id}
                  required
                  checked={slotId === slot.id}
                  onChange={() => setSlotId(slot.id)}
                />
                {formatDateTime(slot.startsAt)}
              </label>
            ))}
          </fieldset>
          <TextArea
            label="Observação (opcional)"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            hint={notice}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={request.pending || !slotId}>
              Solicitar horário
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
