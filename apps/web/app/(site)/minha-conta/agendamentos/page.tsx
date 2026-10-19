'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert, ConfirmDialog, Empty, Loading } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { formatDateTime, formatMoney } from '../../../../lib/format';
import { type Appointment, APPOINTMENT_STATUS } from '../../../../lib/partner-types';
import { useResource } from '../../../../lib/use-resource';

export default function MyAppointmentsPage() {
  const list = useResource<Appointment[]>('/me/appointments');
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  return (
    <>
      <h1>Agendamentos</h1>
      <p className="muted">
        Solicitações de atendimento com profissionais parceiros. Encontre serviços em{' '}
        <Link href="/parceiros">Parceiros</Link>.
      </p>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.length === 0 ? <Empty>Você ainda não solicitou atendimentos.</Empty> : null}
      {list.data?.map((a) => (
        <article key={a.id} className="card stack">
          <div className="row">
            <strong>{a.service.name}</strong>
            <span className={`badge ${APPOINTMENT_STATUS[a.status].badge}`}>
              {APPOINTMENT_STATUS[a.status].label}
            </span>
          </div>
          <span className="muted">
            {a.partner.name}
            {a.professional ? ` · ${a.professional.fullName}` : ''} ·{' '}
            {formatDateTime(a.scheduledStartsAt)}
            {a.quotedPrice ? ` · ${formatMoney(a.quotedPrice.amount)}` : ''}
          </span>
          {a.status === 'REQUESTED' ? <small>Aguardando confirmação da diretoria.</small> : null}
          {a.cancellationReason ? <small>{a.cancellationReason}</small> : null}
          {(a.status === 'REQUESTED' || a.status === 'CONFIRMED') &&
          a.scheduledStartsAt &&
          new Date(a.scheduledStartsAt) > new Date() ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifySelf: 'start' }}
              onClick={() => setCancelling(a)}
            >
              Cancelar
            </button>
          ) : null}
        </article>
      ))}
      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar atendimento"
        description="O horário fica livre para outra pessoa."
        confirmLabel="Cancelar atendimento"
        danger
        requireReason
        onClose={() => setCancelling(null)}
        onConfirm={async (reason) => {
          await api(`/me/appointments/${cancelling?.id ?? ''}/cancel`, {
            method: 'POST',
            body: { reason }
          });
          await list.reload();
        }}
      />
    </>
  );
}
