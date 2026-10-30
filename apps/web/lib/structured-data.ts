import type { NewsDetail, TeamEvent } from './content-types';
import { eventHeadline, eventPlace } from './content-types';
import { SITE_URL } from './site-url';

/** Endereço absoluto de um caminho do site (imagens servidas pelo próprio domínio, DT-022). */
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

const PUBLISHER = {
  '@type': 'SportsOrganization',
  name: 'Fênix Vôlei',
  sport: 'Volleyball',
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: absoluteUrl('/brand/logo-fenix.png') }
} as const;

/** Notícia para buscadores (schema.org `NewsArticle`; docs/31, Onda 2). */
export function newsArticleData(news: NewsDetail): Record<string, unknown> {
  const url = absoluteUrl(`/noticias/${news.slug}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title.slice(0, 110),
    ...(news.summary ? { description: news.summary } : {}),
    image: [absoluteUrl(news.coverUrl ?? '/brand/logo-fenix.png')],
    ...(news.publishedAt ? { datePublished: news.publishedAt } : {}),
    ...(news.updatedAt ? { dateModified: news.updatedAt } : {}),
    articleSection: news.category.name,
    author: news.authorName
      ? { '@type': 'Person', name: news.authorName }
      : { '@type': 'Organization', name: PUBLISHER.name },
    publisher: PUBLISHER,
    mainEntityOfPage: url,
    url
  };
}

const EVENT_STATUS_SCHEMA: Record<TeamEvent['status'], string> = {
  DRAFT: 'https://schema.org/EventScheduled',
  SCHEDULED: 'https://schema.org/EventScheduled',
  COMPLETED: 'https://schema.org/EventScheduled',
  CANCELLED: 'https://schema.org/EventCancelled'
};

/** Evento para buscadores (schema.org `SportsEvent`; docs/31, Onda 3). */
export function sportsEventData(event: TeamEvent): Record<string, unknown> {
  const town = eventPlace(event);
  const place = [event.locationName, event.address, town].filter(Boolean).join(', ');
  const teams = event.match
    ? ['Fênix Vôlei', event.match.opponentName]
    : event.externalMatch
      ? [event.externalMatch.homeTeamName, event.externalMatch.awayTeamName]
      : [];
  const price = event.admission.isFree ? '0' : event.admission.price?.amount;

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: eventHeadline(event),
    startDate: event.startsAt,
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    eventStatus: EVENT_STATUS_SCHEMA[event.status],
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(place
      ? {
          location: {
            '@type': 'Place',
            name: event.locationName ?? town ?? place,
            address: place
          }
        }
      : {}),
    ...(event.description ? { description: event.description.slice(0, 300) } : {}),
    image: [absoluteUrl(event.coverUrl ?? '/brand/logo-fenix.png')],
    ...(teams.length > 0
      ? { competitor: teams.map((name) => ({ '@type': 'SportsTeam', name })) }
      : {}),
    ...(price === undefined
      ? {}
      : {
          offers: {
            '@type': 'Offer',
            price,
            priceCurrency: event.admission.price?.currency ?? 'BRL',
            ...(event.officialUrl ? { url: event.officialUrl } : {})
          }
        }),
    organizer: event.isExternal
      ? {
          '@type': 'Organization',
          name: event.organizerName,
          ...(event.officialUrl ? { url: event.officialUrl } : {})
        }
      : PUBLISHER,
    url: absoluteUrl(`/eventos/${event.slug}`)
  };
}
