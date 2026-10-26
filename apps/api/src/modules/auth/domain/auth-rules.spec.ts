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

describe('regras de autenticação', () => {
  it('normaliza o e-mail', () => {
    expect(normalizeEmail('  Maria@Exemplo.COM ')).toBe('maria@exemplo.com');
  });

  it('aceita senha forte', () => {
    expect(validatePassword('volei-forte-2026')).toEqual([]);
  });

  it.each([
    ['curta1', 'PASSWORD_TOO_SHORT'],
    ['somenteletrasmuitas', 'PASSWORD_WEAK'],
    ['12345678901', 'PASSWORD_WEAK']
  ])('rejects %s', (password, code) => {
    expect(validatePassword(password).map((error) => error.code)).toContain(code);
  });

  it('recusa senha que contém o nome ou o usuário do e-mail', () => {
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

    it('detecta sessão ativa', () => {
      expect(
        classifyRefreshSession({ expiresAt: future, revokedAt: null, revocationReason: null }, now)
      ).toBe('ACTIVE');
    });

    it('detecta sessão expirada', () => {
      expect(
        classifyRefreshSession(
          { expiresAt: new Date('2026-10-18T11:59:59Z'), revokedAt: null, revocationReason: null },
          now
        )
      ).toBe('EXPIRED');
    });

    it('tolera renovação simultânea dentro da margem', () => {
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

    it('acusa reuso de token antigo já renovado', () => {
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

    it('trata sair como revogação simples', () => {
      expect(
        classifyRefreshSession(
          { expiresAt: future, revokedAt: now, revocationReason: REVOCATION.logout },
          now
        )
      ).toBe('REVOKED');
    });
  });

  describe('duração da sessão (DT-036)', () => {
    const login = new Date('2026-10-20T06:00:00Z');
    const minutes = (n: number): Date => new Date(login.getTime() + n * 60_000);
    const days = (n: number): Date => minutes(n * 24 * 60);

    it('trata conta sem permissão administrativa como comum', () => {
      expect(sessionLimitsFor([])).toBe(SESSION_POLICY.standard);
      expect(sessionLimitsFor(['forum.members.access'])).toBe(SESSION_POLICY.standard);
    });

    it('trata qualquer permissão administrativa como privilegiada', () => {
      expect(sessionLimitsFor(['forum.members.access', 'fees.read'])).toBe(
        SESSION_POLICY.privileged
      );
    });

    it('expira sessão privilegiada depois de 30 minutos sem uso', () => {
      const timeline = { authenticatedAt: login, lastActivityAt: login };

      expect(evaluateSessionLifetime(timeline, SESSION_POLICY.privileged, minutes(29))).toBe(
        'ACTIVE'
      );
      expect(evaluateSessionLifetime(timeline, SESSION_POLICY.privileged, minutes(30))).toBe(
        'IDLE_TIMEOUT'
      );
    });

    it('encerra sessão privilegiada depois de 12 horas, mesmo com uso contínuo', () => {
      const busy = { authenticatedAt: login, lastActivityAt: minutes(12 * 60 - 1) };

      expect(evaluateSessionLifetime(busy, SESSION_POLICY.privileged, minutes(12 * 60))).toBe(
        'ABSOLUTE_TIMEOUT'
      );
    });

    it('mantém sessão comum por 7 dias parada e 30 dias no total', () => {
      const idle = { authenticatedAt: login, lastActivityAt: login };
      const busy = { authenticatedAt: login, lastActivityAt: days(29) };

      expect(evaluateSessionLifetime(idle, SESSION_POLICY.standard, days(6))).toBe('ACTIVE');
      expect(evaluateSessionLifetime(idle, SESSION_POLICY.standard, days(7))).toBe('IDLE_TIMEOUT');
      expect(evaluateSessionLifetime(busy, SESSION_POLICY.standard, days(30))).toBe(
        'ABSOLUTE_TIMEOUT'
      );
    });

    it('reproduz o caso relatado: cinco dias parada encerram a sessão administrativa', () => {
      const timeline = { authenticatedAt: login, lastActivityAt: minutes(14) };

      expect(evaluateSessionLifetime(timeline, SESSION_POLICY.privileged, days(5))).not.toBe(
        'ACTIVE'
      );
    });

    it('calcula o prazo máximo a partir do login com senha', () => {
      expect(absoluteDeadline(login, SESSION_POLICY.privileged)).toEqual(minutes(12 * 60));
    });
  });

  describe('segunda etapa (DT-037)', () => {
    const board = new Set(['forum.members.access', 'finance.read', 'fees.read']);

    it('retira as permissões administrativas até a segunda etapa ser comprovada', () => {
      expect([...effectivePermissions(board, false)]).toEqual(['forum.members.access']);
      expect(effectivePermissions(board, true)).toBe(board);
    });

    it('não mexe em contas comuns', () => {
      const athlete = new Set(['forum.members.access']);

      expect(effectivePermissions(athlete, false)).toBe(athlete);
    });

    it('reconhece e normaliza códigos de recuperação', () => {
      expect(RECOVERY_CODE_PATTERN.test('ABCD-EF23-4567')).toBe(true);
      expect(RECOVERY_CODE_PATTERN.test('123456')).toBe(false);
      expect(normalizeRecoveryCode(' abcd-ef23-4567 ')).toBe('ABCDEF234567');
    });
  });
});
