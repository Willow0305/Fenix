import type { Metadata } from 'next';
import Link from 'next/link';

import { EventCard } from '../../../components/event-card';
import { groupAgenda } from '../../../lib/calendar';
import { EVENT_TYPE, type EventType, type TeamEvent } from '../../../lib/content-types';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = {
  title: 'Agenda de vôlei',
  description:
    'Jogos, seletivas e eventos do Fênix Vôlei e do vôlei no Acre e fora dele, com data, local e placar.'
};

type Region = 'acre' | 'outros';
type Origin = 'fenix' | 'external';

const REGIONS: readonly (readonly [Region | undefined, string])[] = [
  [undefined, 'Todos os lugares'],
  ['acre', 'Acre'],
  ['outros', 'Outros lugares']
];
const ORIGINS: Record<Origin, string> = { fenix: 'Do Fênix', external: 'De outros organizadores' };

interface Filters {
  readonly type: EventType | undefined;
  readonly region: Region | undefined;
  readonly origin: Origin | undefined;
}

function parseFilters(params: { tipo?: string; onde?: string; de?: string }): Filters {
  return {
    type: params.tipo && params.tipo in EVENT_TYPE ? (params.tipo as EventType) : undefined,
    region: params.onde === 'acre' || params.onde === 'outros' ? params.onde : undefined,
    origin: params.de === 'fenix' || params.de === 'external' ? params.de : undefined
  };
}

function agendaHref(filters: Filters): string {
  const qs = new URLSearchParams();

  if (filters.type) qs.set('tipo', filters.type);
  if (filters.region) qs.set('onde', filters.region);
  if (filters.origin) qs.set('de', filters.origin);

  return `/eventos${qs.size ? `?${qs.toString()}` : ''}`;
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

/**
 * Agenda (docs/31, Onda 3): hoje, próximos 7 dias e depois. O Acre fica em destaque no
 * filtro de lugar (PEN-069); eventos de outros organizadores entram com D3 (DT-081).
 */
export default async function EventsPage({
  searchParams
}: {
  readonly searchParams: Promise<{ tipo?: string; onde?: string; de?: string }>;
}) {
  const filters = parseFilters(await searchParams);
  const api = new URLSearchParams();

  if (filters.type) api.set('type', filters.type);
  if (filters.region) api.set('region', filters.region);
  if (filters.origin) api.set('origin', filters.origin);

  const query = api.size ? `&${api.toString()}` : '';
  const [upcoming, past] = await Promise.all([
    serverGet<TeamEvent[]>(`/public/events?scope=upcoming&limit=60${query}`, 30),
    serverGet<TeamEvent[]>(`/public/events?scope=past&limit=12${query}`, 60)
  ]);
  const groups = groupAgenda(upcoming ?? []);
  const filtered = Boolean(filters.type || filters.region || filters.origin);

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <header className="stack gap-sm">
        <h1 className="m-0">Agenda</h1>
        <p className="muted m-0">
          Jogos e eventos do Fênix e do vôlei no Acre e fora dele. Horários de Rio Branco.
        </p>
      </header>
      <nav aria-label="Lugar" className="row">
        {REGIONS.map(([value, label]) => (
          <Link
            key={label}
            href={agendaHref({ ...filters, region: value })}
            className={`btn btn-sm ${filters.region === value ? 'btn-primary' : 'btn-secondary'}`}
            aria-current={filters.region === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form action="/eventos" className="agenda-filters" aria-label="Filtrar a agenda">
        {filters.region ? <input type="hidden" name="onde" value={filters.region} /> : null}
        <div className="field">
          <label htmlFor="agenda-tipo">Tipo</label>
          <select id="agenda-tipo" name="tipo" defaultValue={filters.type ?? ''}>
            <option value="">Todos</option>
            {Object.entries(EVENT_TYPE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="agenda-de">Organização</label>
          <select id="agenda-de" name="de" defaultValue={filters.origin ?? ''}>
            <option value="">Todas</option>
            {Object.entries(ORIGINS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
        {filtered ? <Link href="/eventos">Limpar filtros</Link> : null}
      </form>
      {upcoming && upcoming.length > 0 ? (
        <>
          <Group id="hoje" title="Hoje" events={groups.today} />
          <Group id="semana" title="Nos próximos 7 dias" events={groups.week} />
          <Group id="depois" title="Mais para frente" events={groups.later} />
        </>
      ) : (
        <div className="card empty stack gap-sm">
          <p className="m-0">
            {filtered
              ? 'Nenhum evento marcado com esses filtros por enquanto.'
              : 'Nenhum evento marcado por enquanto.'}
          </p>
          {filtered ? (
            <p className="m-0">
              <Link href="/eventos">Ver a agenda completa</Link>
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
