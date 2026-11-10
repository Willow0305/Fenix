import {
  DEFAULT_FORUM_RULES,
  isActiveSuspension,
  longestSuspension,
  ruleTitles,
  suspensionEnd
} from './forum-sanctions';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('advertências e suspensões do fórum (DT-108)', () => {
  it('prazo de 7 ou 30 dias, ou até liberar', () => {
    expect(suspensionEnd(NOW, 7)?.toISOString()).toBe('2026-11-17T12:00:00.000Z');
    expect(suspensionEnd(NOW, 30)?.toISOString()).toBe('2026-12-10T12:00:00.000Z');
    expect(suspensionEnd(NOW, null)).toBeNull();
  });

  it('suspensão vale até o prazo ou até ser liberada; advertência não bloqueia', () => {
    const until = new Date('2026-11-11T12:00:00Z');

    expect(isActiveSuspension({ kind: 'SUSPENSION', endsAt: until, liftedAt: null }, NOW)).toBe(
      true
    );
    expect(
      isActiveSuspension(
        { kind: 'SUSPENSION', endsAt: until, liftedAt: null },
        new Date('2026-11-11T12:00:01Z')
      )
    ).toBe(false);
    expect(isActiveSuspension({ kind: 'SUSPENSION', endsAt: null, liftedAt: null }, NOW)).toBe(
      true
    );
    expect(isActiveSuspension({ kind: 'SUSPENSION', endsAt: null, liftedAt: NOW }, NOW)).toBe(
      false
    );
    expect(isActiveSuspension({ kind: 'WARNING', endsAt: null, liftedAt: null }, NOW)).toBe(false);
  });

  it('entre várias em vigor, a que dura mais; sem prazo vence', () => {
    const week = { kind: 'SUSPENSION' as const, endsAt: suspensionEnd(NOW, 7), liftedAt: null };
    const month = { kind: 'SUSPENSION' as const, endsAt: suspensionEnd(NOW, 30), liftedAt: null };
    const open = { kind: 'SUSPENSION' as const, endsAt: null, liftedAt: null };

    expect(longestSuspension([week, month], NOW)).toBe(month);
    expect(longestSuspension([month, open, week], NOW)).toBe(open);
    expect(longestSuspension([{ ...week, liftedAt: NOW }], NOW)).toBeNull();
  });

  it('as linhas numeradas das regras viram sugestões de "regra quebrada"', () => {
    expect(ruleTitles(DEFAULT_FORUM_RULES)).toEqual([
      'Respeito',
      'Sem discriminação',
      'Privacidade',
      'Menores de idade',
      'Assunto',
      'Verdade'
    ]);
    expect(ruleTitles('Texto livre sem números')).toEqual([]);
  });
});
