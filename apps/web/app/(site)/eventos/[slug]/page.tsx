import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { MediaImage } from '../../../../components/media-image';
import {
  EVENT_STATUS,
  EVENT_TYPE,
  scoreLabel,
  type TeamEvent
} from '../../../../lib/content-types';
import { formatDateTime } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';

async function load(slug: string): Promise<TeamEvent | null> {
  return serverGet<TeamEvent>(`/public/events/${encodeURIComponent(slug)}`, 30);
}

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const event = await load((await params).slug);

  return {
    title: event?.title ?? 'Evento',
    description: event?.description?.slice(0, 160) ?? undefined,
    ...(event?.coverUrl ? { openGraph: { images: [event.coverUrl] } } : {})
  };
}

/** Página do evento, para ler por inteiro como uma notícia (data, local, placar e texto). */
export default async function EventPage({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const event = await load((await params).slug);

  if (event === null) {
    notFound();
  }

  const mapQuery = encodeURIComponent(
    [event.locationName, event.address].filter(Boolean).join(', ')
  );

  return (
    <article className="container stack event-page">
      <p className="m-0">
        <Link href="/eventos">
          <Icon name="arrow-left" /> Eventos
        </Link>
      </p>
      <small className="muted">
        {EVENT_TYPE[event.type]}
        {event.status !== 'SCHEDULED' ? ` · ${EVENT_STATUS[event.status].label}` : ''}
      </small>
      <h1 className="m-0">{event.match ? scoreLabel(event.match) : event.title}</h1>
      {event.match && event.title !== scoreLabel(event.match) ? (
        <p className="m-0">{event.title}</p>
      ) : null}
      {event.coverUrl ? (
        <MediaImage src={event.coverUrl} alt="" priority className="news-cover" />
      ) : null}
      <ul className="stack gap-sm list-plain">
        <li>
          <Icon name="calendar-event" />{' '}
          <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
          {event.endsAt ? ` até ${formatDateTime(event.endsAt)}` : ''}
        </li>
        {event.locationName || event.address ? (
          <li>
            <Icon name="geo-alt" />{' '}
            {[event.locationName, event.address].filter(Boolean).join(' · ')}{' '}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              ver no mapa
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
      {/* Texto simples renderizado como texto, nunca como HTML (DT-034). */}
      {event.description ? <div className="prose">{event.description}</div> : null}
      {event.tryout ? (
        <aside className="card">
          <Icon name="clipboard-check" /> Seletiva:{' '}
          <Link href={`/seletivas/${event.tryout.slug}`}>{event.tryout.title}</Link>
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
