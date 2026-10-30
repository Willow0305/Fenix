import { rankMostRead, windowStart } from './most-read';

describe('mais lidas (D5, DT-081)', () => {
  it('conta os últimos 7 dias civis, com hoje, atravessando o mês', () => {
    expect(windowStart('2026-11-03')).toBe('2026-10-28');
    expect(windowStart('2026-11-03', 1)).toBe('2026-11-03');
  });

  it('ordena por leituras, desempata pela mais recente e ignora quem não teve leitura', () => {
    const at = (iso: string) => new Date(iso);
    const ranked = rankMostRead(
      [
        { id: 'a', views: 3, publishedAt: at('2026-10-01') },
        { id: 'b', views: 9, publishedAt: at('2026-10-02') },
        { id: 'c', views: 3, publishedAt: at('2026-10-05') },
        { id: 'd', views: 0, publishedAt: at('2026-10-06') }
      ],
      5
    );

    expect(ranked.map((row) => row.id)).toEqual(['b', 'c', 'a']);
  });
});
