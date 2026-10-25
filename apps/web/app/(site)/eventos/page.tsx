import type { Metadata } from 'next';
import { EventCard } from '../../../components/event-card';
import type { TeamEvent } from '../../../lib/content-types';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Eventos e partidas' };
export const revalidate = 30;

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
          <div className="card-grid" style={{ '--card-min': '300px' } as React.CSSProperties}>
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <p className="card empty">Nenhum evento agendado por enquanto.</p>
        )}
      </section>
      {past && past.length > 0 ? (
        <section className="stack" aria-labelledby="resultados">
          <h2 id="resultados">Resultados e eventos recentes</h2>
          <div className="card-grid" style={{ '--card-min': '300px' } as React.CSSProperties}>
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
