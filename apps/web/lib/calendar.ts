import type { TeamEvent } from './content-types';
import { eventHeadline } from './content-types';
import { calendarDaysBetween } from './format';

/** Sem término informado, o evento ocupa 2 horas na agenda da pessoa. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function icsDate(iso: string | Date): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Texto do iCalendar (RFC 5545 §3.3.11): barra, vírgula, ponto e vírgula e quebra de linha. */
function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function utf8Length(codePoint: number): number {
  return codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
}

/** Dobra linhas em 75 bytes (RFC 5545 §3.1) sem partir um caractere acentuado ao meio. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;

  for (const char of line) {
    const bytes = utf8Length(char.codePointAt(0) ?? 0);
    const limit = parts.length === 0 ? 75 : 74;

    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }

    current += char;
    size += bytes;
  }

  parts.push(current);

  return parts.join('\r\n ');
}

/** Arquivo de calendário de um evento público (D4, DT-081): "adicionar à agenda". */
export function eventIcs(event: TeamEvent, url: string, now: Date = new Date()): string {
  const end = event.endsAt ?? new Date(Date.parse(event.startsAt) + DEFAULT_DURATION_MS);
  const place = [event.locationName, event.address].filter(Boolean).join(', ');
  const description = [event.description, url].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fenix Volei//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@fenix-volei`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(eventHeadline(event))}`,
    ...(place ? [`LOCATION:${icsText(place)}`] : []),
    `DESCRIPTION:${icsText(description)}`,
    `URL:${url}`,
    `STATUS:${event.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return `${lines.map(fold).join('\r\n')}\r\n`;
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
