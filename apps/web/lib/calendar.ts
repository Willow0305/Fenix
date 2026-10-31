import type { TeamEvent } from './content-types';
import { eventHeadline } from './content-types';
import { calendarDaysBetween } from './format';

/** Sem término informado, o evento ocupa 2 horas na agenda da pessoa. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Data no formato do Google Agenda: UTC, sem separadores (20261105T230000Z). */
function calendarDate(iso: string | Date): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Descrição curta: o link do evento sempre cabe, o texto longo é cortado. */
const MAX_DETAILS = 600;

/**
 * "Adicionar à agenda" (D4, revisto em 2026-10-30): abre o Google Agenda com o evento já
 * preenchido, sem baixar arquivo. Nada é registrado sobre quem toca no botão.
 */
export function googleCalendarUrl(event: TeamEvent, url: string): string {
  const end = event.endsAt ?? new Date(Date.parse(event.startsAt) + DEFAULT_DURATION_MS);
  const place = [event.locationName, event.address].filter(Boolean).join(', ');
  const text = event.description ?? '';
  const summary = text.length > MAX_DETAILS ? `${text.slice(0, MAX_DETAILS).trimEnd()}…` : text;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventHeadline(event),
    dates: `${calendarDate(event.startsAt)}/${calendarDate(end)}`,
    details: [summary, url].filter(Boolean).join('\n\n'),
    ...(place ? { location: place } : {})
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export interface AgendaGroups {
  readonly today: TeamEvent[];
  readonly week: TeamEvent[];
  readonly later: TeamEvent[];
}

/** Agenda por dia no fuso do time: hoje (ou em andamento), próximos 7 dias e depois. */
export function groupAgenda(events: readonly TeamEvent[], now: Date = new Date()): AgendaGroups {
  const groups: AgendaGroups = { today: [], week: [], later: [] };

  for (const event of events) {
    const daysAhead = -calendarDaysBetween(event.startsAt, now);

    if (daysAhead <= 0) {
      groups.today.push(event);
    } else if (daysAhead <= 7) {
      groups.week.push(event);
    } else {
      groups.later.push(event);
    }
  }

  return groups;
}
