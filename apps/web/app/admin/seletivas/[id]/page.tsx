'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { AthleteForm } from '../../../../components/athlete-form';
import { TryoutForm } from '../../../../components/tryout-form';
import {
  Alert,
  ConfirmDialog,
  Empty,
  Loading,
  PageHeader,
  Pagination
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate, formatDateTime, formatPhoneDisplay } from '../../../../lib/format';
import {
  type AthleteDetail,
  REGISTRATION_NEXT,
  REGISTRATION_STATUS,
  type RegistrationStatus,
  type Team,
  TRYOUT_NEXT,
  TRYOUT_STATUS,
  type Tryout,
  type TryoutRegistration,
  type TryoutStatus
} from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';
import { ContactActions } from '../../../../components/contact-actions';
import { Icon } from '../../../../components/icon';

const REASON_REQUIRED: RegistrationStatus[] = ['REJECTED', 'CANCELLED'];

export default function TryoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const tryout = useResource<Tryout>(`/tryouts/${id}`);
  const teams = useResource<Team[]>('/teams');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<RegistrationStatus | ''>('');
  const registrations = useResource<Page<TryoutRegistration>>(`/tryouts/${id}/registrations`, {
    page,
    pageSize: 25,
    status: filter
  });
  const [editing, setEditing] = useState(false);
  const [nextStatus, setNextStatus] = useState<TryoutStatus | null>(null);
  const [review, setReview] = useState<{
    registration: TryoutRegistration;
    status: RegistrationStatus;
  } | null>(null);
  const [converting, setConverting] = useState<TryoutRegistration | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!tryout.data) {
    return tryout.error ? <Alert kind="error">{tryout.error}</Alert> : <Loading />;
  }

  const t = tryout.data;
  const manage = can('tryouts.manage');
  const reviewer = can('registrations.review');

  return (
    <>
      <PageHeader
        title={t.title}
        description={`${t.startsAt ? formatDateTime(t.startsAt) : 'Data a definir'}${t.location ? ` · ${t.location}` : ''}`}
        actions={
          <>
            {t.status !== 'DRAFT' && t.status !== 'CANCELLED' ? (
              <Link href={`/seletivas/${t.slug}`} target="_blank">
                Ver página pública
              </Link>
            ) : null}
            <Link href="/admin/seletivas">
              <Icon name="arrow-left" /> Voltar
            </Link>
          </>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <section className="card row">
        <span className={`badge ${TRYOUT_STATUS[t.status].badge}`}>
          {TRYOUT_STATUS[t.status].label}
        </span>
        <span>
          {t.usedSlots} inscrição(ões){t.maxSlots ? ` de ${t.maxSlots} vagas` : ''}
        </span>
        {t.blockReason && t.status === 'OPEN' ? (
          <span className="muted">{t.blockReason}</span>
        ) : null}
        <span className="spacer" />
        {manage
          ? TRYOUT_NEXT[t.status].map((status) => (
              <button
                key={status}
                type="button"
                className={`btn btn-sm ${status === 'CANCELLED' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setNextStatus(status)}
              >
                {status === 'OPEN' ? 'Abrir inscrições' : TRYOUT_STATUS[status].label}
              </button>
            ))
          : null}
        {manage && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Fechar edição' : 'Editar'}
          </button>
        ) : null}
      </section>
      {t.cancellationReason ? (
        <Alert kind="warning">Cancelada: {t.cancellationReason}</Alert>
      ) : null}
      {editing ? (
        <section className="card">
          <TryoutForm
            key={t.id}
            source={t}
            teams={teams.data ?? []}
            submitLabel="Salvar"
            onSubmit={async (payload) => {
              tryout.setData(
                await api<Tryout>(`/tryouts/${id}`, { method: 'PATCH', body: payload })
              );
              setEditing(false);
              setNotice('Seletiva atualizada.');
            }}
          />
        </section>
      ) : null}

      <section className="stack" aria-labelledby="inscricoes">
        <div className="row">
          <h2 id="inscricoes" style={{ margin: 0 }}>
            Inscrições
          </h2>
          <span className="spacer" />
          <select
            aria-label="Filtrar por status"
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value as RegistrationStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(REGISTRATION_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
        {registrations.loading && !registrations.data ? <Loading /> : null}
        {registrations.data?.data.length === 0 ? <Empty>Nenhuma inscrição.</Empty> : null}
        {registrations.data?.data.map((r) => (
          <article key={r.id} className="card stack" style={{ gap: '0.4rem' }}>
            <div className="row">
              <strong>{r.fullName}</strong>
              <span className={`badge ${REGISTRATION_STATUS[r.status].badge}`}>
                {REGISTRATION_STATUS[r.status].label}
              </span>
              <span className="spacer" />
              <small className="muted">{formatDateTime(r.createdAt)}</small>
            </div>
            <span className="muted">
              {formatDate(r.birthDate)} · {r.email} · {formatPhoneDisplay(r.phone)}
              {r.desiredPosition ? ` · ${r.desiredPosition}` : ''}
            </span>
            {r.guardianName ? (
              <span className="muted">
                Responsável: {r.guardianName} ({formatPhoneDisplay(r.guardianPhone)})
              </span>
            ) : null}
            <div className="row gap-sm">
              <ContactActions phone={r.phone} email={r.email} who="inscrito" />
              {r.guardianPhone ? (
                <ContactActions phone={r.guardianPhone} who="responsável" />
              ) : null}
            </div>
            {r.experience ? (
              <p className="prose" style={{ margin: 0 }}>
                {r.experience}
              </p>
            ) : null}
            {r.reviewReason ? <span>Motivo: {r.reviewReason}</span> : null}
            <div className="row">
              {reviewer
                ? REGISTRATION_NEXT[r.status].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReview({ registration: r, status })}
                    >
                      {REGISTRATION_STATUS[status].label}
                    </button>
                  ))
                : null}
              {(r.status === 'APPROVED' || r.status === 'ATTENDED') &&
              !r.athleteId &&
              can('registrations.review', 'athletes.create') ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setConverting(r)}
                >
                  Criar atleta
                </button>
              ) : null}
              {r.athleteId ? <Link href={`/admin/atletas/${r.athleteId}`}>Ver atleta</Link> : null}
            </div>
            {converting?.id === r.id ? (
              <div className="card stack">
                <h3>Criar atleta a partir da inscrição</h3>
                <AthleteForm
                  mode="create"
                  source={{
                    fullName: r.fullName,
                    birthDate: r.birthDate,
                    email: r.email,
                    phone: r.phone,
                    gender: r.gender,
                    guardianName: r.guardianName,
                    guardianPhone: r.guardianPhone,
                    desiredPosition: r.desiredPosition
                  }}
                  submitLabel="Criar atleta"
                  onSubmit={async (payload) => {
                    const created = await api<AthleteDetail>(
                      `/tryout-registrations/${r.id}/convert`,
                      { method: 'POST', body: payload }
                    );

                    setConverting(null);
                    setNotice(`Atleta ${created.fullName} criado a partir da inscrição.`);
                    await registrations.reload();
                  }}
                />
                <button type="button" className="btn btn-link" onClick={() => setConverting(null)}>
                  Cancelar
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {registrations.data ? <Pagination {...registrations.data.meta} onChange={setPage} /> : null}
      </section>

      <ConfirmDialog
        open={nextStatus !== null}
        title={`Seletiva: ${nextStatus ? TRYOUT_STATUS[nextStatus].label : ''}`}
        description={
          nextStatus === 'CANCELLED' ? 'Inscritos com conta serão notificados.' : undefined
        }
        confirmLabel="Confirmar"
        danger={nextStatus === 'CANCELLED'}
        requireReason={nextStatus === 'CANCELLED'}
        onClose={() => setNextStatus(null)}
        onConfirm={async (reason) => {
          tryout.setData(
            await api<Tryout>(`/tryouts/${id}/status`, {
              method: 'PUT',
              body: { status: nextStatus, ...(reason ? { reason } : {}) }
            })
          );
          setNotice('Status da seletiva atualizado.');
        }}
      />
      <ConfirmDialog
        open={review !== null}
        title={`${review?.registration.fullName ?? ''}: ${review ? REGISTRATION_STATUS[review.status].label : ''}`}
        description={
          review?.status === 'APPROVED' || review?.status === 'REJECTED'
            ? 'Se a pessoa tiver conta, ela será notificada.'
            : undefined
        }
        confirmLabel="Confirmar"
        requireReason={review !== null && REASON_REQUIRED.includes(review.status)}
        onClose={() => setReview(null)}
        onConfirm={async (reason) => {
          await api(`/tryout-registrations/${review?.registration.id ?? ''}/status`, {
            method: 'PUT',
            body: { status: review?.status, ...(reason ? { reason } : {}) }
          });
          await Promise.all([registrations.reload(), tryout.reload()]);
        }}
      />
    </>
  );
}
