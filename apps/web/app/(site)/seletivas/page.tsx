import type { Metadata } from 'next';
import Link from 'next/link';

import { LiveRefresh } from '../../../components/live-refresh';
import { formatDateTime } from '../../../lib/format';
import { serverGet } from '../../../lib/server-api';
import { TRYOUT_STATUS, type Tryout } from '../../../lib/sports-types';

export const metadata: Metadata = { title: 'Seletivas' };
export const revalidate = 30;

export default async function TryoutsPage() {
  const tryouts = (await serverGet<Tryout[]>('/public/tryouts', 30)) ?? [];

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <LiveRefresh topics={['tryouts']} />
      <h1>Seletivas</h1>
      <p className="muted">Horários exibidos no fuso do time (Rio Branco).</p>
      {tryouts.length === 0 ? (
        <div className="card stack">
          <p>Nenhuma seletiva publicada no momento.</p>
          <p>
            <Link href="/interesse">Deixe seu contato</Link> para ser avisado(a) da próxima.
          </p>
        </div>
      ) : (
        <div className="stack">
          {tryouts.map((tryout) => (
            <article key={tryout.id} className="card stack">
              <div className="row">
                <h2 style={{ margin: 0 }}>
                  <Link href={`/seletivas/${tryout.slug}`}>{tryout.title}</Link>
                </h2>
                <span className={`badge ${TRYOUT_STATUS[tryout.status].badge}`}>
                  {TRYOUT_STATUS[tryout.status].label}
                </span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {tryout.team ? `${tryout.team.name} · ` : ''}
                {tryout.startsAt ? formatDateTime(tryout.startsAt) : 'Data a definir'}
                {tryout.location ? ` · ${tryout.location}` : ''}
              </p>
              {tryout.acceptingRegistrations ? (
                <Link
                  href={`/seletivas/${tryout.slug}`}
                  className="btn btn-primary"
                  style={{ justifySelf: 'start' }}
                >
                  Inscrever-se
                </Link>
              ) : tryout.blockReason ? (
                <span className="muted">{tryout.blockReason}</span>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
