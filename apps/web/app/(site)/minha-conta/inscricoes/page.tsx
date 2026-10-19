'use client';

import Link from 'next/link';

import { Alert, Empty, Loading, PageHeader } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { REGISTRATION_STATUS, type TryoutRegistration } from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

export default function MyRegistrationsPage() {
  const registrations = useResource<TryoutRegistration[]>('/me/tryout-registrations');

  return (
    <>
      <PageHeader
        title="Minhas inscrições"
        description="Inscrições em seletivas feitas com esta conta."
      />
      {registrations.error ? <Alert kind="error">{registrations.error}</Alert> : null}
      {registrations.loading && !registrations.data ? <Loading /> : null}
      {registrations.data?.length === 0 ? (
        <Empty>
          Nenhuma inscrição ainda. <Link href="/seletivas">Ver seletivas</Link>
        </Empty>
      ) : null}
      {registrations.data?.map((registration) => (
        <article key={registration.id} className="card row">
          <div className="stack" style={{ gap: '0.25rem' }}>
            <strong>
              <Link href={`/seletivas/${registration.tryout.slug}`}>
                {registration.tryout.title}
              </Link>
            </strong>
            <span className="muted">Enviada em {formatDateTime(registration.createdAt)}</span>
          </div>
          <span className="spacer" />
          <span className={`badge ${REGISTRATION_STATUS[registration.status].badge}`}>
            {REGISTRATION_STATUS[registration.status].label}
          </span>
        </article>
      ))}
    </>
  );
}
