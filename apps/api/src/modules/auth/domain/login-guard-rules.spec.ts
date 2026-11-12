import {
  failureStillCounts,
  LOGIN_FAILURE_WINDOW_SECONDS,
  LOGIN_LOCK_MAX_SECONDS,
  lockMessage,
  lockSecondsAfter,
  remainingLockSeconds,
  reserveAttempt
} from './login-guard-rules';

describe('freio de tentativas de login por conta', () => {
  it.each([
    [0, 0],
    [1, 0],
    [4, 0],
    [5, 60],
    [6, 120],
    [7, 240],
    [8, 480],
    [9, LOGIN_LOCK_MAX_SECONDS],
    [50, LOGIN_LOCK_MAX_SECONDS],
    [1_000_000, LOGIN_LOCK_MAX_SECONDS]
  ])('depois de %p falhas seguidas bloqueia por %p segundos', (failures, seconds) => {
    expect(lockSecondsAfter(failures)).toBe(seconds);
  });

  it('ignora contagem inválida', () => {
    expect(lockSecondsAfter(-1)).toBe(0);
    expect(lockSecondsAfter(5.5)).toBe(0);
    expect(lockSecondsAfter(Number.NaN)).toBe(0);
  });

  it('esquece a sequência depois de 24 horas sem falha', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const window = LOGIN_FAILURE_WINDOW_SECONDS * 1000;

    expect(failureStillCounts(new Date(now.getTime() - window + 1000), now)).toBe(true);
    expect(failureStillCounts(new Date(now.getTime() - window), now)).toBe(false);
  });

  it('calcula o tempo que falta do bloqueio', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');

    expect(remainingLockSeconds(null, now)).toBe(0);
    expect(remainingLockSeconds(new Date('2026-11-11T11:59:00.000Z'), now)).toBe(0);
    expect(remainingLockSeconds(new Date('2026-11-11T12:00:00.400Z'), now)).toBe(1);
    expect(remainingLockSeconds(new Date('2026-11-11T12:02:00.000Z'), now)).toBe(120);
  });

  it('avisa quanto esperar, com singular e plural', () => {
    expect(lockMessage(30)).toContain('tente de novo em 1 minuto ');
    expect(lockMessage(60)).toContain('em 1 minuto ');
    expect(lockMessage(61)).toContain('em 2 minutos ');
    expect(lockMessage(900)).toContain('em 15 minutos ');
    expect(lockMessage(0)).toContain('em 1 minuto ');
  });

  describe('reserva da tentativa (antes de conferir a senha)', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

    it('primeira tentativa conta 1 e não bloqueia', () => {
      expect(reserveAttempt(null, now)).toEqual({
        kind: 'ALLOWED',
        failures: 1,
        lockedUntil: null
      });
    });

    it('a 5ª reservada já bloqueia as seguintes por 1 minuto', () => {
      const decision = reserveAttempt(
        { failures: 4, lastFailureAt: minutesAgo(1), lockedUntil: null },
        now
      );

      expect(decision).toEqual({
        kind: 'ALLOWED',
        failures: 5,
        lockedUntil: new Date(now.getTime() + 60_000)
      });
    });

    it('com bloqueio em vigor recusa e diz quanto falta', () => {
      expect(
        reserveAttempt(
          { failures: 5, lastFailureAt: now, lockedUntil: new Date(now.getTime() + 45_000) },
          now
        )
      ).toEqual({ kind: 'LOCKED', remainingSeconds: 45 });
    });

    it('bloqueio vencido: a próxima tentativa dobra o tempo', () => {
      expect(
        reserveAttempt(
          { failures: 5, lastFailureAt: minutesAgo(2), lockedUntil: minutesAgo(1) },
          now
        )
      ).toEqual({ kind: 'ALLOWED', failures: 6, lockedUntil: new Date(now.getTime() + 120_000) });
    });

    it('sequência de mais de 24 horas recomeça em 1', () => {
      expect(
        reserveAttempt(
          {
            failures: 9,
            lastFailureAt: minutesAgo(24 * 60),
            lockedUntil: minutesAgo(24 * 60 - 15)
          },
          now
        )
      ).toEqual({ kind: 'ALLOWED', failures: 1, lockedUntil: null });
    });
  });
});
