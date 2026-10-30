import type { Metadata } from 'next';
import Link from 'next/link';

import { EventCard } from '../../../components/event-card';
import { groupAgenda } from '../../../lib/calendar';
import { EVENT_TYPE, type EventType, type TeamEvent } from '../../../lib/content-types';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = {
  title: 'Agenda de eventos e partidas',
  description: 'Jogos, seletivas e eventos do Fênix Vôlei, com data, local e placar.'
};

const FILTERS: readonly EventType[] = [
  'MATCH',
  'FRIENDLY',
  'TRYOUT',
  'TRAINING',
  'COMMUNITY',
  'OTHER'
];

function isEventType(value: string | undefined): value is EventType {
  return value !== undefined && value in EVENT_TYPE;
}

function Group({
  id,
  title,
  events
}: {
  readonly id: string;
  readonly title: string;
  readonly events: readonly TeamEvent[];
}) {
  return events.length > 0 ? (
    <section className="stack" aria-labelledby={id}>
      <h2 id={id} className="list-title">
        {title}
      </h2>
      <div className="card-grid" style={{ '--card-min': '300px' } as React.CSSProperties}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  ) : null;
}

/** Agenda (docs/31, Onda 3): hoje, próximos 7 dias e depois, com filtro por tipo. */
export default async function EventsPage({
  searchParams
}: {
  readonly searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const type = isEventType(tipo) ? tipo : undefined;
  const filter = type ? `&type=${type}` : '';
  const [upcoming, past] = await Promise.all([
    serverGet<TeamEvent[]>(`/public/events?scope=upcoming&limit=60${filter}`, 30),
    serverGet<TeamEvent[]>(`/public/events?scope=past&limit=12${filter}`, 60)
  ]);
  const groups = groupAgenda(upcoming ?? []);
  const chip = (value: EventType | undefined, label: string) => (
    <Link
      key={value ?? 'todos'}
      href={value ? `/eventos?tipo=${value}` : '/eventos'}
      className={`btn btn-sm ${type === value ? 'btn-primary' : 'btn-secondary'}`}
      aria-current={type === value ? 'page' : undefined}
    >
      {label}
    </Link>
  );

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <header className="stack gap-sm">
        <h1 className="m-0">Agenda</h1>
        <p className="muted m-0">Jogos e eventos com horário de Rio Branco (Acre).</p>
      </header>
      <nav aria-label="Tipo de evento" className="row">
        {chip(undefined, 'Todos')}
        {FILTERS.map((value) => chip(value, EVENT_TYPE[value]))}
      </nav>
      {upcoming && upcoming.length > 0 ? (
        <>
          <Group id="hoje" title="Hoje" events={groups.today} />
          <Group id="semana" title="Nos próximos 7 dias" events={groups.week} />
          <Group id="depois" title="Mais para frente" events={groups.later} />
        </>
      ) : (
        <div className="card empty stack gap-sm">
          <p className="m-0">
            {type
              ? `Nenhum evento do tipo "${EVENT_TYPE[type]}" marcado por enquanto.`
              : 'Nenhum evento marcado por enquanto.'}
          </p>
          {type ? (
            <p className="m-0">
              <Link href="/eventos">Ver todos os eventos</Link>
            </p>
          ) : null}
        </div>
      )}
      {past && past.length > 0 ? (
        <Group id="resultados" title="Resultados e eventos recentes" events={past} />
      ) : null}
    </div>
  );
}
