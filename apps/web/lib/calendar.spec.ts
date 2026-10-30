/** @jest-environment node */
import { eventIcs, groupAgenda } from './calendar';
import type { TeamEvent } from './content-types';

const base: TeamEvent = {
  id: '6f1c3c2e-0000-4000-8000-000000000001',
  title: 'Final, estadual; quadra 1',
  slug: 'final',
  type: 'MATCH',
  status: 'SCHEDULED',
  description: 'Chegue cedo.\nTraga água.',
  startsAt: '2026-11-05T23:00:00Z',
  endsAt: null,
  locationName: 'Ginásio Álvaro',
  address: 'Rua A, 10',
  isPublic: true,
  publishedAt: '2026-10-01T00:00:00Z',
  coverUrl: null,
  match: null,
  isExternal: false,
  organizerName: null,
  officialUrl: null,
  city: null,
  state: null,
  admission: { isFree: false, price: null },
  externalMatch: null,
  tryout: null,
  news: []
};

describe('arquivo de calendário', () => {
  const ics = eventIcs(
    base,
    'http://localhost:3000/eventos/final',
    new Date('2026-10-30T12:00:00Z')
  );

  it('usa UTC, 2 horas de duração padrão e quebras de linha CRLF', () => {
    expect(ics).toContain('DTSTART:20261105T230000Z\r\n');
    expect(ics).toContain('DTEND:20261106T010000Z\r\n');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapa vírgula, ponto e vírgula e quebra de linha do texto', () => {
    expect(ics).toContain('SUMMARY:Final\\, estadual\\; quadra 1');
    expect(ics).toContain('LOCATION:Ginásio Álvaro\\, Rua A\\, 10');
    expect(ics).toContain('DESCRIPTION:Chegue cedo.\\nTraga água.');
  });

  it('dobra linhas longas em até 75 bytes', () => {
    const long = eventIcs({ ...base, description: 'á'.repeat(200) }, 'http://x');
    const encoder = new TextEncoder();

    for (const line of long.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('marca o evento cancelado', () => {
    expect(eventIcs({ ...base, status: 'CANCELLED' }, 'http://x')).toContain('STATUS:CANCELLED');
  });
});

describe('agenda agrupada', () => {
  it('separa hoje, próximos 7 dias e depois, no fuso do time', () => {
    // 30/10/2026 às 22h em Rio Branco = 31/10 03h UTC.
    const now = new Date('2026-10-31T03:00:00Z');
    const at = (startsAt: string) => ({ ...base, id: startsAt, startsAt });
    const groups = groupAgenda(
      [
        at('2026-10-31T04:00:00Z'),
        at('2026-10-31T06:00:00Z'),
        at('2026-11-06T15:00:00Z'),
        at('2026-11-07T15:00:00Z')
      ],
      now
    );

    expect(groups.today.map((e) => e.id)).toEqual(['2026-10-31T04:00:00Z']);
    expect(groups.week.map((e) => e.id)).toEqual(['2026-10-31T06:00:00Z', '2026-11-06T15:00:00Z']);
    expect(groups.later.map((e) => e.id)).toEqual(['2026-11-07T15:00:00Z']);
  });
});
