import type { FieldError } from '../../../common/errors/app-error';

/** Regras puras de identidade e sessão (RN-AUT-001/002, DT-022, DT-026). */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const MINIMUM_ACCOUNT_AGE = 12;
export const ROTATION_GRACE_SECONDS = 10;
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Política de senha: comprimento mínimo, ao menos uma letra e um número, e não pode
 * conter o e-mail ou o nome. Comprimento é o fator principal (NIST SP 800-63B).
 */
export function validatePassword(
  password: string,
  context: { email?: string; name?: string } = {}
): FieldError[] {
  const errors: FieldError[] = [];
  const add = (code: string, message: string): void => {
    errors.push({ field: 'password', code, message });
  };

  if (password.length < PASSWORD_MIN_LENGTH) {
    add('PASSWORD_TOO_SHORT', `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    add('PASSWORD_TOO_LONG', `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  }

  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    add('PASSWORD_WEAK', 'A senha deve combinar letras e números.');
  }

  const lower = password.toLowerCase();
  const emailUser = context.email ? normalizeEmail(context.email).split('@')[0] : undefined;
  const firstName = context.name?.trim().split(/\s+/)[0]?.toLowerCase();

  if (
    (emailUser && emailUser.length >= 4 && lower.includes(emailUser)) ||
    (firstName && firstName.length >= 4 && lower.includes(firstName))
  ) {
    add('PASSWORD_PERSONAL', 'A senha não pode conter seu nome ou e-mail.');
  }

  return errors;
}

export type SessionState = 'ACTIVE' | 'EXPIRED' | 'ROTATED_RECENTLY' | 'REUSED' | 'REVOKED';

export interface SessionSnapshot {
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revocationReason: string | null;
}

export const REVOCATION = {
  rotated: 'ROTATED',
  logout: 'LOGOUT',
  passwordChanged: 'PASSWORD_CHANGED',
  passwordReset: 'PASSWORD_RESET',
  reuseDetected: 'REUSE_DETECTED',
  revokedByUser: 'REVOKED_BY_USER',
  revokedByAdmin: 'REVOKED_BY_ADMIN',
  accountDisabled: 'ACCOUNT_DISABLED',
  idleTimeout: 'IDLE_TIMEOUT',
  absoluteTimeout: 'ABSOLUTE_TIMEOUT'
} as const;

/**
 * Limites de sessão (DT-036). Contas privilegiadas — qualquer permissão além do acesso
 * à área de membros — expiram por inatividade em 30 min e duram no máximo 12 h desde o
 * login; contas comuns, 7 dias e 30 dias.
 */
export const SESSION_POLICY = {
  privileged: { idleSeconds: 30 * 60, absoluteSeconds: 12 * 60 * 60 },
  standard: { idleSeconds: 7 * 24 * 60 * 60, absoluteSeconds: 30 * 24 * 60 * 60 }
} as const;

/** Intervalo mínimo entre gravações de `lastActivityAt`, para não escrever a cada requisição. */
export const ACTIVITY_WRITE_INTERVAL_SECONDS = 60;

const NON_PRIVILEGED_PERMISSIONS: ReadonlySet<string> = new Set(['forum.members.access']);

export interface SessionLimits {
  readonly idleSeconds: number;
  readonly absoluteSeconds: number;
}

export function sessionLimitsFor(permissions: Iterable<string>): SessionLimits {
  for (const permission of permissions) {
    if (!NON_PRIVILEGED_PERMISSIONS.has(permission)) {
      return SESSION_POLICY.privileged;
    }
  }

  return SESSION_POLICY.standard;
}

export interface SessionTimeline {
  readonly authenticatedAt: Date;
  readonly lastActivityAt: Date;
}

export type SessionLifetimeState = 'ACTIVE' | 'IDLE_TIMEOUT' | 'ABSOLUTE_TIMEOUT';

/**
 * Avalia inatividade e duração máxima com os limites das permissões atuais, de modo que
 * uma promoção a perfil administrativo encurte imediatamente uma sessão já aberta.
 */
export function evaluateSessionLifetime(
  timeline: SessionTimeline,
  limits: SessionLimits,
  now: Date
): SessionLifetimeState {
  const elapsed = (from: Date): number => (now.getTime() - from.getTime()) / 1000;

  if (elapsed(timeline.authenticatedAt) >= limits.absoluteSeconds) {
    return 'ABSOLUTE_TIMEOUT';
  }

  return elapsed(timeline.lastActivityAt) >= limits.idleSeconds ? 'IDLE_TIMEOUT' : 'ACTIVE';
}

/** Instante em que a sessão termina mesmo com uso contínuo. */
export function absoluteDeadline(authenticatedAt: Date, limits: SessionLimits): Date {
  return new Date(authenticatedAt.getTime() + limits.absoluteSeconds * 1000);
}

/**
 * Classifica uma sessão apresentada no refresh. Um token já rotacionado reapresentado
 * fora da janela de tolerância indica roubo/reuso e exige revogar todas as sessões.
 */
export function classifyRefreshSession(session: SessionSnapshot, now: Date): SessionState {
  if (session.revokedAt !== null) {
    if (session.revocationReason !== REVOCATION.rotated) {
      return 'REVOKED';
    }

    const elapsed = (now.getTime() - session.revokedAt.getTime()) / 1000;

    return elapsed <= ROTATION_GRACE_SECONDS ? 'ROTATED_RECENTLY' : 'REUSED';
  }

  return session.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : 'ACTIVE';
}
