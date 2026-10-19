'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AthleteForm } from '../../../components/athlete-form';
import {
  Alert,
  ConfirmDialog,
  Empty,
  Loading,
  PageHeader,
  Pagination
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDate, formatDateTime } from '../../../lib/format';
import {
  type AthleteDetail,
  INTERESTED_NEXT,
  INTERESTED_STATUS,
  type Interested,
  type InterestedStatus
} from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';

export default function InterestedPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InterestedStatus | ''>('');
  const list = useResource<Page<Interested>>('/interested-people', { page, pageSize: 20, status });
  const [change, setChange] = useState<{ person: Interested; status: InterestedStatus } | null>(
    null
  );
  const [converting, setConverting] = useState<Interested | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Interessados"
        description="Pessoas que deixaram contato pelo site. Envio não cria conta nem atleta."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <label className="field" style={{ maxWidth: 260 }}>
        <span className="label">Status</span>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as InterestedStatus | '');
          }}
        >
          <option value="">Todos</option>
          {Object.entries(INTERESTED_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </label>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhum interessado.</Empty> : null}
      {list.data?.data.map((person) => (
        <article key={person.id} className="card stack" style={{ gap: '0.5rem' }}>
          <div className="row">
            <strong>{person.fullName}</strong>
            <span className={`badge ${INTERESTED_STATUS[person.status].badge}`}>
              {INTERESTED_STATUS[person.status].label}
            </span>
            <span className="spacer" />
            <small className="muted">{formatDateTime(person.createdAt)}</small>
          </div>
          <span className="muted">
            Nascimento {formatDate(person.birthDate)} · {person.email} · {person.phone}
            {person.desiredPosition ? ` · ${person.desiredPosition}` : ''}
          </span>
          {person.guardianName ? (
            <span className="muted">
              Responsável: {person.guardianName} ({person.guardianPhone})
            </span>
          ) : null}
          {person.notes ? (
            <p className="prose" style={{ margin: 0 }}>
              {person.notes}
            </p>
          ) : null}
          <div className="row">
            {can('registrations.review')
              ? INTERESTED_NEXT[person.status].map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setChange({ person, status: next })}
                  >
                    {INTERESTED_STATUS[next].label}
                  </button>
                ))
              : null}
            {person.status !== 'CONVERTED' && can('registrations.review', 'athletes.create') ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setConverting(person)}
              >
                Converter em atleta
              </button>
            ) : null}
            {person.convertedAthleteId ? (
              <Link href={`/admin/atletas/${person.convertedAthleteId}`}>Ver atleta</Link>
            ) : null}
          </div>
          {converting?.id === person.id ? (
            <div className="card stack">
              <h3>Conversão em atleta</h3>
              <p className="muted">
                Revise e complete os dados. A conversão fica registrada na auditoria.
              </p>
              <AthleteForm
                mode="create"
                source={{
                  fullName: person.fullName,
                  birthDate: person.birthDate,
                  email: person.email,
                  phone: person.phone,
                  guardianName: person.guardianName,
                  guardianPhone: person.guardianPhone,
                  desiredPosition: person.desiredPosition
                }}
                submitLabel="Criar atleta"
                onSubmit={async (payload) => {
                  const created = await api<AthleteDetail>(
                    `/interested-people/${person.id}/convert`,
                    { method: 'POST', body: payload }
                  );

                  setConverting(null);
                  setNotice(`Atleta ${created.fullName} criado.`);
                  await list.reload();
                }}
              />
              <button type="button" className="btn btn-link" onClick={() => setConverting(null)}>
                Cancelar
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {list.data ? <Pagination {...list.data.meta} onChange={setPage} /> : null}
      <ConfirmDialog
        open={change !== null}
        title={`Marcar como "${change ? INTERESTED_STATUS[change.status].label : ''}"`}
        confirmLabel="Confirmar"
        onClose={() => setChange(null)}
        onConfirm={async () => {
          await api(`/interested-people/${change?.person.id ?? ''}/status`, {
            method: 'PUT',
            body: { status: change?.status }
          });
          await list.reload();
        }}
      />
    </>
  );
}
