import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { signAccessToken } from '../../../common/crypto/jwt';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword
} from '../../../common/crypto/password-hasher';
import { generateOpaqueToken, sha256Hex } from '../../../common/crypto/tokens';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-context';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { SYSTEM_ROLES } from '../../access/domain/permission-catalog';
import {
  absoluteDeadline,
  classifyRefreshSession,
  evaluateSessionLifetime,
  normalizeEmail,
  PASSWORD_RESET_TTL_SECONDS,
  REVOCATION,
  validatePassword
} from '../domain/auth-rules';
import { SessionLifetimeService } from './session-lifetime.service';

export interface IssuedSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly idleTimeoutSeconds: number;
}

interface SessionTimes {
  readonly authenticatedAt: Date;
  readonly lastActivityAt: Date;
}

export interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
}

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';

function freshTimes(): SessionTimes {
  const now = new Date();

  return { authenticatedAt: now, lastActivityAt: now };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly mail: MailSender,
    private readonly lifetime: SessionLifetimeService
  ) {}

  private assertPassword(password: string, context: { email?: string; name?: string }): void {
    const errors = validatePassword(password, context);

    if (errors.length > 0) {
      throw AppError.validation('WEAK_PASSWORD', 'A senha não atende à política.', errors);
    }
  }

  private async createSession(
    tx: PrismaTx,
    userId: string,
    meta: RequestMeta,
    rotatedFromSessionId: string | null,
    times: SessionTimes
  ): Promise<IssuedSession> {
    const { accessTokenSecret, accessTokenTtlSeconds } = this.config.values;
    const limits = await this.lifetime.limitsForUser(userId, new Date(), tx);
    const refreshToken = generateOpaqueToken();
    const refreshExpiresAt = absoluteDeadline(times.authenticatedAt, limits);
    const session = await tx.userSession.create({
      data: {
        userId,
        refreshTokenHash: sha256Hex(refreshToken),
        rotatedFromSessionId,
        expiresAt: refreshExpiresAt,
        authenticatedAt: times.authenticatedAt,
        lastActivityAt: times.lastActivityAt,
        userAgentHash: meta.userAgent ? sha256Hex(meta.userAgent) : null,
        ipAddressHash: meta.ipAddressHash
      },
      select: { id: true }
    });

    return {
      accessToken: signAccessToken(
        { sub: userId, sid: session.id },
        accessTokenSecret,
        accessTokenTtlSeconds
      ),
      expiresIn: accessTokenTtlSeconds,
      refreshToken,
      refreshExpiresAt,
      idleTimeoutSeconds: limits.idleSeconds
    };
  }

  /** Cadastro livre (PEN-008): cria conta `user` ativa; papéis privilegiados nunca vêm do cliente. */
  async register(input: RegisterInput, meta: RequestMeta): Promise<IssuedSession> {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();

    this.assertPassword(input.password, { email, name });

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (existing !== null) {
      throw AppError.conflict(
        'EMAIL_IN_USE',
        'Este e-mail já possui cadastro. Entre ou recupere a senha.'
      );
    }

    const passwordHash = await hashPassword(input.password);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { code: SYSTEM_ROLES.user },
        select: { id: true }
      });

      if (role === null) {
        throw new Error('Papel padrão ausente: execute npm run db:seed.');
      }

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone: input.phone?.trim() || null,
          passwordHash,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
          userRoles: { create: { roleId: role.id } }
        },
        select: { id: true }
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: 'user.registered',
          entityType: 'User',
          entityId: user.id,
          after: { role: SYSTEM_ROLES.user, termsAccepted: true, minimumAgeDeclared: 12 },
          meta
        },
        tx
      );

      return this.createSession(tx, user.id, meta, null, freshTimes());
    });
  }

  async login(emailInput: string, password: string, meta: RequestMeta): Promise<IssuedSession> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, status: true, deletedAt: true }
    });
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (user === null || !valid) {
      await this.audit.record({
        actorUserId: user?.id ?? null,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user?.id ?? null,
        meta
      });
      throw new AppError('UNAUTHORIZED', 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    if (user.status !== 'ACTIVE' || user.deletedAt !== null) {
      throw new AppError(
        'FORBIDDEN',
        'ACCOUNT_UNAVAILABLE',
        'Conta indisponível. Procure a administração do time.'
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.audit.record(
        { actorUserId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, meta },
        tx
      );

      return this.createSession(tx, user.id, meta, null, freshTimes());
    });
  }

  /**
   * Rotaciona o refresh token (DT-022). Reuso fora da tolerância revoga todas as sessões.
   * `active` informa uso real desde a última renovação; renovações automáticas não
   * prolongam a inatividade, e a duração total nunca passa do limite (DT-036).
   */
  async refresh(refreshToken: string, meta: RequestMeta, active = false): Promise<IssuedSession> {
    const now = new Date();
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: sha256Hex(refreshToken) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        revocationReason: true,
        authenticatedAt: true,
        lastActivityAt: true,
        user: { select: { status: true, deletedAt: true } }
      }
    });

    if (session === null) {
      throw AppError.unauthorized('Sessão expirada. Entre novamente.');
    }

    const state = classifyRefreshSession(session, now);

    if (state === 'REUSED') {
      await this.revokeAllSessions(session.userId, REVOCATION.reuseDetected);
      await this.audit.record({
        actorUserId: session.userId,
        action: 'auth.refresh.reuse_detected',
        entityType: 'UserSession',
        entityId: session.id,
        meta
      });
    }

    if (state !== 'ACTIVE' || session.user.status !== 'ACTIVE' || session.user.deletedAt !== null) {
      throw AppError.unauthorized('Sessão expirada. Entre novamente.');
    }

    const limits = await this.lifetime.limitsForUser(session.userId, now);
    const lifetime = evaluateSessionLifetime(session, limits, now);

    if (lifetime !== 'ACTIVE') {
      await this.lifetime.expire(session, lifetime, meta);
      throw AppError.unauthorized(
        'Sessão encerrada por inatividade ou tempo limite. Entre novamente.'
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.userSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revocationReason: REVOCATION.rotated }
      });

      if (revoked.count !== 1) {
        throw AppError.unauthorized('Sessão expirada. Entre novamente.');
      }

      return this.createSession(tx, session.userId, meta, session.id, {
        authenticatedAt: session.authenticatedAt,
        lastActivityAt: active ? now : session.lastActivityAt
      });
    });
  }

  async logout(refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: sha256Hex(refreshToken) },
      select: { id: true, userId: true, revokedAt: true }
    });

    if (session === null || session.revokedAt !== null) {
      return;
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revocationReason: REVOCATION.logout }
    });
    await this.audit.record({
      actorUserId: session.userId,
      action: 'auth.logout',
      entityType: 'UserSession',
      entityId: session.id,
      meta
    });
  }

  async revokeAllSessions(
    userId: string,
    reason: string,
    exceptSessionId?: string
  ): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId === undefined ? {} : { id: { not: exceptSessionId } })
      },
      data: { revokedAt: new Date(), revocationReason: reason }
    });

    return result.count;
  }

  /** Resposta idêntica exista ou não a conta (não enumera usuários). */
  async requestPasswordReset(emailInput: string, meta: RequestMeta): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, status: true, deletedAt: true }
    });

    if (user === null || user.status !== 'ACTIVE' || user.deletedAt !== null) {
      return;
    }

    const token = generateOpaqueToken();

    await this.prisma.$transaction(async (tx) => {
      await tx.userToken.updateMany({
        where: { userId: user.id, type: 'PASSWORD_RESET', consumedAt: null },
        data: { consumedAt: new Date() }
      });
      await tx.userToken.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          tokenHash: sha256Hex(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000)
        }
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: 'auth.password_reset.requested',
          entityType: 'User',
          entityId: user.id,
          meta
        },
        tx
      );
    });

    const link = `${this.config.values.webOrigin}/redefinir-senha?token=${encodeURIComponent(token)}`;

    await this.mail.send({
      to: user.email,
      subject: 'Redefinição de senha — Fênix Vôlei',
      text: [
        `Olá, ${user.name}.`,
        '',
        'Recebemos um pedido para redefinir sua senha. Use o link abaixo em até 1 hora:',
        link,
        '',
        'Se você não fez este pedido, ignore esta mensagem.'
      ].join('\n')
    });
  }

  async resetPassword(token: string, password: string, meta: RequestMeta): Promise<void> {
    const record = await this.prisma.userToken.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: {
        id: true,
        type: true,
        expiresAt: true,
        consumedAt: true,
        user: { select: { id: true, email: true, name: true } }
      }
    });

    if (
      record === null ||
      record.type !== 'PASSWORD_RESET' ||
      record.consumedAt !== null ||
      record.expiresAt <= new Date()
    ) {
      throw AppError.validation('INVALID_RESET_TOKEN', 'Link de redefinição inválido ou expirado.');
    }

    this.assertPassword(password, { email: record.user.email, name: record.user.name });
    const passwordHash = await hashPassword(password);

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.userToken.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() }
      });

      if (consumed.count !== 1) {
        throw AppError.validation(
          'INVALID_RESET_TOKEN',
          'Link de redefinição inválido ou expirado.'
        );
      }

      await tx.user.update({ where: { id: record.user.id }, data: { passwordHash } });
      await tx.userSession.updateMany({
        where: { userId: record.user.id, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: REVOCATION.passwordReset }
      });
      await this.audit.record(
        {
          actorUserId: record.user.id,
          action: 'auth.password_reset.completed',
          entityType: 'User',
          entityId: record.user.id,
          meta
        },
        tx
      );
    });
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, email: true, name: true }
    });

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw AppError.validation('INVALID_CURRENT_PASSWORD', 'Senha atual incorreta.', [
        { field: 'currentPassword', code: 'INVALID', message: 'Senha atual incorreta.' }
      ]);
    }

    this.assertPassword(newPassword, { email: user.email, name: user.name });
    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null, id: { not: sessionId } },
        data: { revokedAt: new Date(), revocationReason: REVOCATION.passwordChanged }
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'auth.password.changed',
          entityType: 'User',
          entityId: userId,
          meta
        },
        tx
      );
    });
  }
}
