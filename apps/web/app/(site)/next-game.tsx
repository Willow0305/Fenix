import Link from 'next/link';

import { Icon } from '../../components/icon';
import { eventHeadline, eventPlace, type TeamEvent } from '../../lib/content-types';
import { TEAM_TIME_ZONE } from '../../lib/format';
import styles from './home.module.scss';

const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: TEAM_TIME_ZONE });
const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: TEAM_TIME_ZONE });
const WHEN = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TEAM_TIME_ZONE
});

/** Próximo jogo do Fênix no Início, com a data grande e "adicionar à agenda" (Onda 3). */
export function NextGame({ event }: { readonly event: TeamEvent }) {
  const start = new Date(event.startsAt);
  const place = [event.locationName, eventPlace(event)].filter(Boolean).join(' · ');

  return (
    <section className={`container ${styles.section}`} aria-labelledby="proximo-jogo">
      <div className={styles.nextGame}>
        <time className="event-date" dateTime={event.startsAt} aria-hidden="true">
          <strong>{DAY.format(start)}</strong>
          <span>{MONTH.format(start).replace('.', '')}</span>
        </time>
        <div className="stack gap-sm">
          <h2 id="proximo-jogo" className="news-kicker m-0">
            Próximo jogo
          </h2>
          <p className={styles.nextGameTitle}>{eventHeadline(event)}</p>
          <p className="m-0">
            <time dateTime={event.startsAt}>{WHEN.format(start)}</time>
            {place ? ` · ${place}` : ''}
          </p>
          {event.match?.competitionName ? (
            <p className="muted m-0">{event.match.competitionName}</p>
          ) : null}
        </div>
        <div className={styles.nextGameActions}>
          <Link href={`/eventos/${event.slug}`} className="btn btn-primary">
            Ver o jogo
          </Link>
          <a href={`/eventos/${event.slug}/agenda.ics`} className="btn btn-secondary" download>
            <Icon name="calendar-plus" /> Adicionar à agenda
          </a>
        </div>
      </div>
    </section>
  );
}
