/** @jest-environment node */
import { googleCalendarUrl, groupAgenda } from './calendar';
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

describe('link do Google Agenda', () => {
  const params = (event: TeamEvent) =>
    new URL(googleCalendarUrl(event, 'http://localhost:3000/eventos/final')).searchParams;

  it('abre o Google Agenda com o evento preenchido, em UTC e com 2 horas por padrão', () => {
    const url = googleCalendarUrl(base, 'http://localhost:3000/eventos/final');
    const query = params(base);

    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(query.get('action')).toBe('TEMPLATE');
    expect(query.get('dates')).toBe('20261105T230000Z/20261106T010000Z');
    expect(query.get('text')).toBe('Final, estadual; quadra 1');
    expect(query.get('location')).toBe('Ginásio Álvaro, Rua A, 10');
    expect(query.get('details')).toBe(
      'Chegue cedo.\nTraga água.\n\nhttp://localhost:3000/eventos/final'
    );
  });

  it('usa o término informado e corta descrição longa sem perder o link', () => {
    const query = params({
      ...base,
      endsAt: '2026-11-06T02:30:00Z',
      description: 'á'.repeat(2000),
      locationName: null,
      address: null
    });

    expect(query.get('dates')).toBe('20261105T230000Z/20261106T023000Z');
    expect(query.get('details')?.endsWith('…\n\nhttp://localhost:3000/eventos/final')).toBe(true);
    expect(query.has('location')).toBe(false);
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
