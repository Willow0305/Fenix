import type { Metadata } from 'next';
import Link from 'next/link';

import { EVENT_STATUS, EVENT_TYPE, scoreLabel, type TeamEvent } from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Eventos e partidas' };
export const revalidate = 30;

function EventCard({ event }: { readonly event: TeamEvent }) {
  return (
    <article id={event.slug} className="card stack">
      <div className="row">
        <span className="badge">{EVENT_TYPE[event.type]}</span>
        {event.status !== 'SCHEDULED' ? (
          <span className={`badge ${EVENT_STATUS[event.status].badge}`}>
            {EVENT_STATUS[event.status].label}
          </span>
        ) : null}
      </div>
      <h3 style={{ margin: 0 }}>{event.match ? scoreLabel(event.match) : event.title}</h3>
      <span className="muted">
        {formatDateTime(event.startsAt)}
        {event.locationName ? ` · ${event.locationName}` : ''}
        {event.match?.competitionName ? ` · ${event.match.competitionName}` : ''}
      </span>
      {event.description ? (
        <p className="prose" style={{ margin: 0 }}>
          {event.description}
        </p>
      ) : null}
      {event.tryout ? (
        <Link href={`/seletivas/${event.tryout.slug}`}>Inscrições da seletiva</Link>
      ) : null}
      {event.news.map((news) => (
        <Link key={news.id} href={`/noticias/${news.slug}`}>
          Notícia: {news.title}
        </Link>
      ))}
    </article>
  );
}

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([
    serverGet<TeamEvent[]>('/public/events?scope=upcoming', 30),
    serverGet<TeamEvent[]>('/public/events?scope=past&limit=12', 60)
  ]);

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Eventos e partidas</h1>
      <p className="muted">Horários no fuso do time (Rio Branco).</p>
      <section className="stack" aria-labelledby="proximos">
        <h2 id="proximos">Próximos</h2>
        {upcoming && upcoming.length > 0 ? (
          upcoming.map((event) => <EventCard key={event.id} event={event} />)
        ) : (
          <p className="muted">Nenhum evento agendado.</p>
        )}
      </section>
      {past && past.length > 0 ? (
        <section className="stack" aria-labelledby="resultados">
          <h2 id="resultados">Resultados e eventos recentes</h2>
          {past.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
