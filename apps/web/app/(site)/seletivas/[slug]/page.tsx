import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LiveRefresh } from '../../../../components/live-refresh';
import { formatDateTime } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';
import { TRYOUT_STATUS, type Tryout } from '../../../../lib/sports-types';
import { TryoutRegistrationForm } from './registration-form';

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tryout = await serverGet<Tryout>(`/public/tryouts/${encodeURIComponent(slug)}`, 30);

  return { title: tryout?.title ?? 'Seletiva' };
}

export default async function TryoutPage({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tryout = await serverGet<Tryout>(`/public/tryouts/${encodeURIComponent(slug)}`, 30);

  if (tryout === null) {
    notFound();
  }

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem', maxWidth: 860 }}>
      <LiveRefresh topics={['tryouts']} />
      <div className="row">
        <h1 style={{ margin: 0 }}>{tryout.title}</h1>
        <span className={`badge ${TRYOUT_STATUS[tryout.status].badge}`}>
          {TRYOUT_STATUS[tryout.status].label}
        </span>
      </div>
      <dl className="card" style={{ display: 'grid', gap: '0.5rem', margin: 0 }}>
        {tryout.team ? (
          <div>
            <dt className="muted">Equipe</dt>
            <dd style={{ margin: 0 }}>{tryout.team.name}</dd>
          </div>
        ) : null}
        <div>
          <dt className="muted">Data e horário</dt>
          <dd style={{ margin: 0 }}>
            {tryout.startsAt
              ? `${formatDateTime(tryout.startsAt)} (horário de Rio Branco)`
              : 'A definir'}
          </dd>
        </div>
        {tryout.location ? (
          <div>
            <dt className="muted">Local</dt>
            <dd style={{ margin: 0 }}>{tryout.location}</dd>
          </div>
        ) : null}
        {tryout.registrationEndsAt ? (
          <div>
            <dt className="muted">Inscrições até</dt>
            <dd style={{ margin: 0 }}>{formatDateTime(tryout.registrationEndsAt)}</dd>
          </div>
        ) : null}
        {tryout.maxSlots ? (
          <div>
            <dt className="muted">Vagas</dt>
            <dd style={{ margin: 0 }}>
              {Math.max(0, tryout.maxSlots - tryout.usedSlots)} de {tryout.maxSlots} disponíveis
            </dd>
          </div>
        ) : null}
      </dl>
      {tryout.description ? <p className="prose">{tryout.description}</p> : null}
      {tryout.acceptingRegistrations ? (
        <TryoutRegistrationForm slug={tryout.slug} />
      ) : (
        <div className="alert alert-info" role="status">
          {tryout.blockReason ?? 'Inscrições indisponíveis.'}
        </div>
      )}
    </div>
  );
}
