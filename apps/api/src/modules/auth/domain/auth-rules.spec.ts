import {
  absoluteDeadline,
  classifyRefreshSession,
  effectivePermissions,
  evaluateSessionLifetime,
  normalizeRecoveryCode,
  RECOVERY_CODE_PATTERN,
  normalizeEmail,
  REVOCATION,
  SESSION_POLICY,
  sessionLimitsFor,
  validatePassword
} from './auth-rules';

describe('auth rules', () => {
  it('normalizes e-mail', () => {
    expect(normalizeEmail('  Maria@Exemplo.COM ')).toBe('maria@exemplo.com');
  });

  it('accepts a strong password', () => {
    expect(validatePassword('volei-forte-2026')).toEqual([]);
  });

  it.each([
    ['curta1', 'PASSWORD_TOO_SHORT'],
    ['somenteletrasmuitas', 'PASSWORD_WEAK'],
    ['12345678901', 'PASSWORD_WEAK']
  ])('rejects %s', (password, code) => {
    expect(validatePassword(password).map((error) => error.code)).toContain(code);
  });

  it('rejects passwords containing the name or e-mail user', () => {
    expect(
      validatePassword('mariana2026xyz', { name: 'Mariana Souza' }).map((e) => e.code)
    ).toContain('PASSWORD_PERSONAL');
    expect(
      validatePassword('craque-joaovb-9', { email: 'joaovb@exemplo.com' }).map((e) => e.code)
    ).toContain('PASSWORD_PERSONAL');
  });

  describe('classifyRefreshSession', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const future = new Date('2026-11-18T12:00:00Z');

    it('detects an active session', () => {
      expect(
        classifyRefreshSession({ expiresAt: future, revokedAt: null, revocationReason: null }, now)
      ).toBe('ACTIVE');
    });

    it('detects an expired session', () => {
      expect(
        classifyRefreshSession(
          { expiresAt: new Date('2026-10-18T11:59:59Z'), revokedAt: null, revocationReason: null },
          now
        )
      ).toBe('EXPIRED');
    });

    it('tolerates concurrent refresh inside the grace window', () => {
      expect(
        classifyRefreshSession(
          {
            expiresAt: future,
            revokedAt: new Date('2026-10-18T11:59:55Z'),
            revocationReason: REVOCATION.rotated
          },
          now
        )
      ).toBe('ROTATED_RECENTLY');
    });

    it('flags reuse of an old rotated token', () => {
      expect(
        classifyRefreshSession(
          {
            expiresAt: future,
            revokedAt: new Date('2026-10-18T10:00:00Z'),
            revocationReason: REVOCATION.rotated
          },
          now
        )
      ).toBe('REUSED');
    });

    it('treats logout as plain revocation', () => {
      expect(
        classifyRefreshSession(
          { expiresAt: future, revokedAt: now, revocationReason: REVOCATION.logout },
          now
        )
      ).toBe('REVOKED');
    });
  });

  describe('session lifetime (DT-036)', () => {
    const login = new Date('2026-10-20T06:00:00Z');
    const minutes = (n: number): Date => new Date(login.getTime() + n * 60_000);
    const days = (n: number): Date => minutes(n * 24 * 60);

    it('treats accounts without administrative permissions as standard', () => {
      expect(sessionLimitsFor([])).toBe(SESSION_POLICY.standard);
      expect(sessionLimitsFor(['forum.members.access'])).toBe(SESSION_POLICY.standard);
    });

    it('treats any administrative permission as privileged', () => {
      expect(sessionLimitsFor(['forum.members.access', 'fees.read'])).toBe(
        SESSION_POLICY.privileged
      );
    });

    it('expires a privileged session after 30 minutes without use', () => {
      const timeline = { authenticatedAt: login, lastActivityAt: login };

      expect(evaluateSessionLifetime(timeline, SESSION_POLICY.privileged, minutes(29))).toBe(
        'ACTIVE'
      );
      expect(evaluateSessionLifetime(timeline, SESSION_POLICY.privileged, minutes(30))).toBe(
        'IDLE_TIMEOUT'
      );
    });

    it('ends a privileged session after 12 hours even with continuous use', () => {
      const busy = { authenticatedAt: login, lastActivityAt: minutes(12 * 60 - 1) };

      expect(evaluateSessionLifetime(busy, SESSION_POLICY.privileged, minutes(12 * 60))).toBe(
        'ABSOLUTE_TIMEOUT'
      );
    });

    it('keeps a standard session for 7 idle days and 30 days in total', () => {
      const idle = { authenticatedAt: login, lastActivityAt: login };
      const busy = { authenticatedAt: login, lastActivityAt: days(29) };

      expect(evaluateSessionLifetime(idle, SESSION_POLICY.standard, days(6))).toBe('ACTIVE');
      expect(evaluateSessionLifetime(idle, SESSION_POLICY.standard, days(7))).toBe('IDLE_TIMEOUT');
      expect(evaluateSessionLifetime(busy, SESSION_POLICY.standard, days(30))).toBe(
        'ABSOLUTE_TIMEOUT'
      );
    });

    it('reproduces the reported case: five idle days end an administrative session', () => {
      const timeline = { authenticatedAt: login, lastActivityAt: minutes(14) };

      expect(evaluateSessionLifetime(timeline, SESSION_POLICY.privileged, days(5))).not.toBe(
        'ACTIVE'
      );
    });

    it('computes the absolute deadline from the password login', () => {
      expect(absoluteDeadline(login, SESSION_POLICY.privileged)).toEqual(minutes(12 * 60));
    });
  });

  describe('second factor (DT-037)', () => {
    const board = new Set(['forum.members.access', 'finance.read', 'fees.read']);

    it('strips administrative permissions until the second factor is verified', () => {
      expect([...effectivePermissions(board, false)]).toEqual(['forum.members.access']);
      expect(effectivePermissions(board, true)).toBe(board);
    });

    it('leaves common accounts untouched', () => {
      const athlete = new Set(['forum.members.access']);

      expect(effectivePermissions(athlete, false)).toBe(athlete);
    });

    it('recognizes and normalizes recovery codes', () => {
      expect(RECOVERY_CODE_PATTERN.test('ABCD-EF23-4567')).toBe(true);
      expect(RECOVERY_CODE_PATTERN.test('123456')).toBe(false);
      expect(normalizeRecoveryCode(' abcd-ef23-4567 ')).toBe('ABCDEF234567');
    });
  });
});
