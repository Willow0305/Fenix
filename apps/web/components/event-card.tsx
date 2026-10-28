import Link from 'next/link';

import { EVENT_STATUS, EVENT_TYPE, scoreLabel, type TeamEvent } from '../lib/content-types';
import { TEAM_TIME_ZONE } from '../lib/format';
import { Icon } from './icon';
import { MediaImage } from './media-image';

const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: TEAM_TIME_ZONE });
const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: TEAM_TIME_ZONE });
const time = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TEAM_TIME_ZONE
});

/**
 * Cartão de evento (docs/29 COR-011): capa 16:9 (do evento, da notícia vinculada ou a
 * logo Fênix), data em destaque, local e, em partidas, "Fênix x Adversário" com placar.
 */
export function EventCard({
  event,
  compact = false
}: {
  readonly event: TeamEvent;
  readonly compact?: boolean;
}) {
  const start = new Date(event.startsAt);

  return (
    <article id={event.slug} className="content-card">
      <Link href={`/eventos/${event.slug}`} tabIndex={-1} aria-hidden="true">
        <MediaImage src={event.coverUrl} alt="">
          <span className="date-chip" aria-hidden="true">
            <strong>{day.format(start)}</strong>
            <span>{month.format(start).replace('.', '')}</span>
          </span>
          <span className="media-tag">{EVENT_TYPE[event.type]}</span>
          {event.status !== 'SCHEDULED' ? (
            <span className="media-status">{EVENT_STATUS[event.status].label}</span>
          ) : null}
        </MediaImage>
      </Link>
      <div className="content-card-body">
        <h3 className="content-card-title line-clamp-2">
          <Link href={`/eventos/${event.slug}`}>
            {event.match ? scoreLabel(event.match) : event.title}
          </Link>
        </h3>
        <span className="muted">
          <Icon name="calendar-event" /> <time dateTime={event.startsAt}>{time.format(start)}</time>
        </span>
        {event.locationName ? (
          <span className="muted">
            <Icon name="geo-alt" /> {event.locationName}
          </span>
        ) : null}
        {event.match?.competitionName ? (
          <span className="muted">
            <Icon name="trophy" /> {event.match.competitionName}
          </span>
        ) : null}
        {!compact && event.description ? <p className="line-clamp-3">{event.description}</p> : null}
        {!compact && event.tryout ? (
          <Link href={`/seletivas/${event.tryout.slug}`}>Inscrições da seletiva</Link>
        ) : null}
        {!compact
          ? event.news.map((news) => (
              <Link key={news.id} href={`/noticias/${news.slug}`}>
                Notícia: {news.title}
              </Link>
            ))
          : null}
      </div>
    </article>
  );
}
