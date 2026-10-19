'use client';

import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  Loading,
  PageHeader,
  Pagination,
  TextArea
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import {
  type Appointment,
  APPOINTMENT_STATUS,
  type AppointmentStatus
} from '../../../lib/partner-types';
import { useResource } from '../../../lib/use-resource';

const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: []
};

const ACTION_LABEL: Partial<Record<AppointmentStatus, string>> = {
  CONFIRMED: 'Confirmar',
  CANCELLED: 'Cancelar',
  COMPLETED: 'Realizado',
  NO_SHOW: 'Não compareceu'
};

export default function AppointmentsAdminPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AppointmentStatus | ''>('REQUESTED');
  const list = useResource<Page<Appointment>>('/appointments', { page, pageSize: 25, status });
  const [target, setTarget] = useState<{ item: Appointment; status: AppointmentStatus } | null>(
    null
  );
  const [notes, setNotes] = useState('');

  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Solicitações não são confirmações: confirme ou cancele com motivo. O solicitante e o profissional são avisados."
      />
      <div className="row">
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as AppointmentStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(APPOINTMENT_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhum agendamento.</Empty> : null}
      {list.data && list.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Horário</th>
                  <th scope="col">Serviço</th>
                  <th scope="col">Solicitante</th>
                  <th scope="col">Situação</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDateTime(a.scheduledStartsAt)}</td>
                    <td>
                      {a.service.name}
                      <br />
                      <small className="muted">
                        {a.partner.name}
                        {a.professional ? ` · ${a.professional.fullName}` : ''}
                        {a.quotedPrice ? ` · ${formatMoney(a.quotedPrice.amount)}` : ''}
                      </small>
                    </td>
                    <td>
                      {a.requester.name}
                      <br />
                      <small className="muted">
                        {[a.requester.phone, a.requester.email].filter(Boolean).join(' · ')}
                      </small>
                      {a.requesterNotes ? (
                        <>
                          <br />
                          <small>Obs.: {a.requesterNotes}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${APPOINTMENT_STATUS[a.status].badge}`}>
                        {APPOINTMENT_STATUS[a.status].label}
                      </span>
                      {a.cancellationReason ? (
                        <>
                          <br />
                          <small className="muted">{a.cancellationReason}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <div className="row">
                        {NEXT[a.status].map((next) => (
                          <button
                            key={next}
                            type="button"
                            className={`btn btn-sm ${next === 'CANCELLED' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => {
                              setNotes(a.administrativeNotes ?? '');
                              setTarget({ item: a, status: next });
                            }}
                          >
                            {ACTION_LABEL[next]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={list.data.meta.page}
            pageSize={list.data.meta.pageSize}
            total={list.data.meta.total}
            onChange={setPage}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={target !== null}
        title={target ? `${ACTION_LABEL[target.status] ?? ''}: ${target.item.service.name}` : ''}
        description={
          target
            ? `${target.item.requester.name} · ${formatDateTime(target.item.scheduledStartsAt)}`
            : ''
        }
        confirmLabel="Confirmar"
        danger={target?.status === 'CANCELLED'}
        requireReason={target?.status === 'CANCELLED'}
        onClose={() => setTarget(null)}
        onConfirm={async (reason) => {
          if (!target) {
            return;
          }

          await api(`/appointments/${target.item.id}/status`, {
            method: 'PUT',
            body: {
              status: target.status,
              ...(reason ? { reason } : {}),
              ...(notes ? { administrativeNotes: notes } : {})
            }
          });
          await list.reload();
        }}
      >
        <TextArea
          label="Observação interna"
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          hint="Visível só para a diretoria. Não registre dados de saúde."
        />
      </ConfirmDialog>
    </>
  );
}
