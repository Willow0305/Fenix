import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { JsonLd } from '../../../../components/json-ld';
import { MediaImage } from '../../../../components/media-image';
import { ShareButtons } from '../../../../components/share-buttons';
import {
  EVENT_STATUS,
  EVENT_TYPE,
  scoreLabel,
  type TeamEvent
} from '../../../../lib/content-types';
import { TEAM_TIME_ZONE } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';
import { absoluteUrl, sportsEventData } from '../../../../lib/structured-data';

const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: TEAM_TIME_ZONE });
const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: TEAM_TIME_ZONE });
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TEAM_TIME_ZONE });
const FULL_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TEAM_TIME_ZONE
});
const TIME = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TEAM_TIME_ZONE
});

async function load(slug: string): Promise<TeamEvent | null> {
  return serverGet<TeamEvent>(`/public/events/${encodeURIComponent(slug)}`, 30);
}

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const event = await load((await params).slug);

  if (event === null) {
    return { title: 'Evento' };
  }

  const title = event.match ? scoreLabel(event.match) : event.title;
  const description =
    event.description?.slice(0, 160) ??
    `${EVENT_TYPE[event.type]} em ${FULL_DATE.format(new Date(event.startsAt))}.`;

  return {
    title,
    description,
    alternates: { canonical: `/eventos/${event.slug}` },
    openGraph: { title, description, ...(event.coverUrl ? { images: [event.coverUrl] } : {}) }
  };
}

/** Página do evento (docs/31, Onda 3): data grande, local com mapa, agenda e compartilhar. */
export default async function EventPage({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const event = await load((await params).slug);

  if (event === null) {
    notFound();
  }

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  // Página renderizada no servidor a cada pedido: o "agora" é o do pedido.
  const now = Date.now();
  const ended = (end ?? new Date(start.getTime() + 2 * 3_600_000)).getTime() < now;
  const place = [event.locationName, event.address].filter(Boolean).join(' · ');
  const mapQuery = encodeURIComponent(
    [event.locationName, event.address].filter(Boolean).join(', ')
  );
  const title = event.match ? scoreLabel(event.match) : event.title;

  return (
    <article className="container reading">
      <JsonLd data={sportsEventData(event)} />
      <header className="reading-header">
        <p className="row m-0">
          <Link href={`/eventos?tipo=${event.type}`} className="news-kicker">
            {EVENT_TYPE[event.type]}
          </Link>
          {event.status !== 'SCHEDULED' ? (
            <span className={`badge ${EVENT_STATUS[event.status].badge}`}>
              {EVENT_STATUS[event.status].label}
            </span>
          ) : null}
        </p>
        <h1>{title}</h1>
        {event.match && event.title !== title ? (
          <p className="reading-lede">{event.title}</p>
        ) : null}
      </header>
      <section className="card event-when" aria-label="Quando e onde">
        <time className="event-date" dateTime={event.startsAt} aria-hidden="true">
          <strong>{DAY.format(start)}</strong>
          <span>{MONTH.format(start).replace('.', '')}</span>
        </time>
        <ul className="stack gap-sm list-plain m-0">
          <li>
            <Icon name="calendar-event" />{' '}
            <time dateTime={event.startsAt}>
              {WEEKDAY.format(start)}, {FULL_DATE.format(start)}, às {TIME.format(start)}
            </time>
            {end ? ` até ${TIME.format(end)}` : ''}
          </li>
          {place ? (
            <li>
              <Icon name="geo-alt" /> {place}{' '}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no mapa
              </a>
            </li>
          ) : null}
          {event.match?.competitionName ? (
            <li>
              <Icon name="trophy" /> {event.match.competitionName}
              {event.match.team ? ` · ${event.match.team.name}` : ''}
            </li>
          ) : null}
        </ul>
      </section>
      <div className="row">
        {!ended && event.status !== 'CANCELLED' ? (
          <a className="btn btn-primary btn-sm" href={`/eventos/${event.slug}/agenda.ics`} download>
            <Icon name="calendar-plus" /> Adicionar à agenda
          </a>
        ) : null}
        <ShareButtons title={title} url={absoluteUrl(`/eventos/${event.slug}`)} />
      </div>
      {event.coverUrl ? (
        <MediaImage src={event.coverUrl} alt="" priority className="news-cover" />
      ) : null}
      {/* Texto simples renderizado como texto, nunca como HTML (DT-034). */}
      {event.description ? <div className="prose reading-body">{event.description}</div> : null}
      {event.tryout ? (
        <aside className="card row">
          <Icon name="clipboard-check" />
          <span>
            Seletiva: <Link href={`/seletivas/${event.tryout.slug}`}>{event.tryout.title}</Link>
          </span>
        </aside>
      ) : null}
      {event.news.length > 0 ? (
        <aside className="card stack gap-sm">
          <strong>Notícias relacionadas</strong>
          {event.news.map((news) => (
            <Link key={news.id} href={`/noticias/${news.slug}`}>
              {news.title}
            </Link>
          ))}
        </aside>
      ) : null}
    </article>
  );
}
