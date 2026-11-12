import {
  failureStillCounts,
  LOGIN_FAILURE_WINDOW_SECONDS,
  LOGIN_LOCK_MAX_SECONDS,
  lockMessage,
  lockSecondsAfter,
  remainingLockSeconds
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
});
