import { classifyRefreshSession, normalizeEmail, REVOCATION, validatePassword } from './auth-rules';

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
});
