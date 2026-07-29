import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common';
import { UserStatus, UserTokenType } from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import {
  createNumericCode,
  createOpaqueSecret,
  hashSecret,
  normalizeEmail,
  safelyEqualHash
} from '../common/security/security';
import { readCookies } from '../common/http/cookies';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AccessTokenService } from './access-token.service';
import { AuthConfig } from './auth.config';
import { MfaService } from './mfa.service';
import { PasswordHasherService } from './password-hasher.service';

const AUTH_USER_INCLUDE = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  },
  mfaCredential: true
} as const;

export interface SessionCredentials {
  readonly status: 'SESSION_CREATED';
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
  readonly accessExpiresAt: Date;
  readonly sessionExpiresAt: Date;
  readonly principal: AuthenticatedPrincipal;
}

export interface MfaChallengeRequired {
  readonly status: 'MFA_REQUIRED';
  readonly challengeToken: string;
  readonly expiresAt: Date;
}

export type LoginResult = SessionCredentials | MfaChallengeRequired;

interface RequestContext {
  readonly request: RequestWithPrincipal;
}

function createAuthenticationError(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'E-mail, senha ou estado da conta não permitem o acesso.'
  });
}

function createRecoveryError(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_RECOVERY_CODE',
    message: 'O código não é válido, expirou ou já foi utilizado.'
  });
}

@Injectable()
export class AuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AuthConfig,
    private readonly passwordHasher: PasswordHasherService,
    private readonly accessTokens: AccessTokenService,
    private readonly emailDelivery: EmailService,
    private readonly mfa: MfaService,
    private readonly rateLimits: RateLimitService
  ) {}

  public async login(
    emailInput: string,
    password: string,
    context: RequestContext
  ): Promise<LoginResult> {
    const email = normalizeEmail(emailInput);
    const accountLimit = await this.rateLimits.consume('login', `account:${email}`);

    if (!accountLimit.allowed) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Muitas tentativas. Aguarde antes de tentar novamente.'
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: AUTH_USER_INCLUDE
    });
    const passwordMatches = user
      ? await this.passwordHasher.verify(password, user.passwordHash)
      : Boolean(await this.passwordHasher.hash(password)) && false;
    const now = new Date();

    if (
      !user ||
      !passwordMatches ||
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerifiedAt ||
      user.deletedAt ||
      (user.blockedUntil !== null && user.blockedUntil > now)
    ) {
      if (user && !passwordMatches && user.status === UserStatus.ACTIVE && !user.deletedAt) {
        await this.recordFailedLogin(user.id, now, context.request);
      } else {
        await this.audit.record({
          action: AUDIT_ACTIONS.loginFailed,
          entityType: 'User',
          ...(user ? { entityId: user.id } : {}),
          reason: user ? 'ACCOUNT_UNAVAILABLE' : 'INVALID_CREDENTIALS',
          request: context.request
        });
      }

      throw createAuthenticationError();
    }

    const roles = this.activeRoleCodes(user, now);

    if (user.mfaCredential?.confirmedAt) {
      const challenge = await this.mfa.createLoginChallenge(user.id);

      return {
        status: 'MFA_REQUIRED',
        ...challenge
      };
    }

    const mfaEnrollmentRequired = this.mfa.isRequiredForRoles(roles);
    const sessionMaterial = this.createSessionMaterial({
      userId: user.id,
      now,
      mfaVerifiedAt: mfaEnrollmentRequired ? null : now
    });

    await this.prisma.$transaction(async (database) => {
      await database.user.update({
        where: { id: user.id },
        data: {
          blockedUntil: null,
          failedLoginAttempts: 0,
          loginFailureWindowStartedAt: null,
          lastLoginAt: now
        }
      });
      await database.userSession.create({
        data: sessionMaterial.sessionData
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.loginSucceeded,
          actorUserId: user.id,
          entityType: 'UserSession',
          entityId: sessionMaterial.sessionData.id,
          request: context.request
        },
        database
      );
    });

    return {
      status: 'SESSION_CREATED',
      accessToken: this.accessTokens.issue(user.id, sessionMaterial.sessionData.id),
      refreshToken: sessionMaterial.refreshToken,
      csrfToken: sessionMaterial.csrfToken,
      accessExpiresAt: new Date(now.getTime() + this.config.accessTokenMinutes * 60_000),
      sessionExpiresAt: sessionMaterial.sessionData.expiresAt,
      principal: this.toPrincipal(
        user,
        sessionMaterial.sessionData.id,
        now,
        sessionMaterial.sessionData.mfaVerifiedAt
      )
    };
  }

  public async completeMfaLogin(
    challengeToken: string,
    code: string,
    context: RequestContext
  ): Promise<SessionCredentials> {
    const userId = await this.mfa.verifyLoginChallenge(challengeToken, code, context.request);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: AUTH_USER_INCLUDE
    });
    const now = new Date();

    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt || user.deletedAt) {
      throw createAuthenticationError();
    }

    const sessionMaterial = this.createSessionMaterial({
      userId,
      now,
      mfaVerifiedAt: now
    });

    await this.prisma.$transaction(async (database) => {
      await database.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: now,
          failedLoginAttempts: 0,
          loginFailureWindowStartedAt: null,
          blockedUntil: null
        }
      });
      await database.userSession.create({
        data: sessionMaterial.sessionData
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.loginSucceeded,
          actorUserId: userId,
          entityType: 'UserSession',
          entityId: sessionMaterial.sessionData.id,
          request: context.request
        },
        database
      );
    });

    return {
      status: 'SESSION_CREATED',
      accessToken: this.accessTokens.issue(userId, sessionMaterial.sessionData.id),
      refreshToken: sessionMaterial.refreshToken,
      csrfToken: sessionMaterial.csrfToken,
      accessExpiresAt: new Date(now.getTime() + this.config.accessTokenMinutes * 60_000),
      sessionExpiresAt: sessionMaterial.sessionData.expiresAt,
      principal: this.toPrincipal(user, sessionMaterial.sessionData.id, now, now)
    };
  }

  public async refresh(
    refreshToken: string | undefined,
    context: RequestContext
  ): Promise<SessionCredentials> {
    const parsed = this.parseRefreshToken(refreshToken);
    const session = parsed
      ? await this.prisma.userSession.findUnique({
          where: { id: parsed.sessionId },
          include: {
            user: {
              include: AUTH_USER_INCLUDE
            }
          }
        })
      : null;
    const now = new Date();
    const expectedHash =
      session && parsed
        ? hashSecret(parsed.secret, this.config.tokenPepper, `refresh:${session.id}`)
        : '';
    const hashMatches =
      session !== null &&
      expectedHash !== '' &&
      safelyEqualHash(expectedHash, session.refreshTokenHash);

    if (
      !session ||
      !hashMatches ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.user.emailVerifiedAt ||
      session.user.deletedAt
    ) {
      throw createAuthenticationError();
    }

    if (session.revokedAt) {
      await this.prisma.$transaction(async (database) => {
        await database.userSession.updateMany({
          where: {
            userId: session.userId,
            revokedAt: null
          },
          data: {
            revokedAt: now,
            revocationReason: 'REFRESH_TOKEN_REUSE'
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.sessionReuseDetected,
            actorUserId: session.userId,
            entityType: 'UserSession',
            entityId: session.id,
            reason: 'REVOKED_REFRESH_REUSED',
            request: context.request
          },
          database
        );
      });
      throw createAuthenticationError();
    }

    if (this.isInactive(session.lastActivityAt, now)) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: {
          revokedAt: now,
          revocationReason: 'INACTIVITY_TIMEOUT'
        }
      });
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Sua sessão expirou por inatividade.'
      });
    }

    const nextSession = this.createSessionMaterial({
      userId: session.userId,
      now,
      rotatedFromSessionId: session.id,
      absoluteExpiresAt: session.absoluteExpiresAt,
      mfaVerifiedAt: session.mfaVerifiedAt ? now : null
    });

    await this.prisma.$transaction(async (database) => {
      const rotation = await database.userSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revocationReason: 'REFRESH_ROTATED'
        }
      });

      if (rotation.count !== 1) {
        await database.userSession.updateMany({
          where: {
            userId: session.userId,
            revokedAt: null
          },
          data: {
            revokedAt: now,
            revocationReason: 'CONCURRENT_REFRESH_REUSE'
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.sessionReuseDetected,
            actorUserId: session.userId,
            entityType: 'UserSession',
            entityId: session.id,
            reason: 'CONCURRENT_REFRESH_REUSE',
            request: context.request
          },
          database
        );
        throw createAuthenticationError();
      }

      await database.userSession.create({
        data: nextSession.sessionData
      });
    });

    return {
      status: 'SESSION_CREATED',
      accessToken: this.accessTokens.issue(session.userId, nextSession.sessionData.id),
      refreshToken: nextSession.refreshToken,
      csrfToken: nextSession.csrfToken,
      accessExpiresAt: new Date(now.getTime() + this.config.accessTokenMinutes * 60_000),
      sessionExpiresAt: nextSession.sessionData.expiresAt,
      principal: this.toPrincipal(
        session.user,
        nextSession.sessionData.id,
        now,
        nextSession.sessionData.mfaVerifiedAt
      )
    };
  }

  public async logout(principal: AuthenticatedPrincipal, context: RequestContext): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (database) => {
      await database.userSession.updateMany({
        where: {
          id: principal.sessionId,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revocationReason: 'USER_LOGOUT'
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.logout,
          actorUserId: principal.userId,
          entityType: 'UserSession',
          entityId: principal.sessionId,
          request: context.request
        },
        database
      );
    });
  }

  public async requestPasswordRecovery(emailInput: string, context: RequestContext): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      return;
    }

    const now = new Date();
    const tokenId = randomUUID();
    const code = createNumericCode(this.config.recoveryCodeLength);
    const expiresAt = new Date(now.getTime() + this.config.recoveryCodeMinutes * 60_000);

    await this.prisma.$transaction(async (database) => {
      await database.userToken.updateMany({
        where: {
          userId: user.id,
          type: UserTokenType.PASSWORD_RESET,
          consumedAt: null
        },
        data: {
          consumedAt: now
        }
      });
      await database.userToken.create({
        data: {
          id: tokenId,
          userId: user.id,
          type: UserTokenType.PASSWORD_RESET,
          tokenHash: hashSecret(code, this.config.tokenPepper, `recovery:${tokenId}`),
          expiresAt
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.passwordRecoveryRequested,
          entityType: 'UserToken',
          entityId: tokenId,
          request: context.request
        },
        database
      );
    });

    try {
      await this.emailDelivery.sendPasswordRecovery(
        user.email,
        code,
        this.config.recoveryCodeMinutes
      );
    } catch {
      await this.prisma.userToken.update({
        where: { id: tokenId },
        data: {
          consumedAt: new Date()
        }
      });
    }
  }

  public async resetPassword(
    emailInput: string,
    code: string,
    newPassword: string,
    context: RequestContext
  ): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email }
    });
    const now = new Date();

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      hashSecret(code, this.config.tokenPepper, 'recovery:unknown');
      throw createRecoveryError();
    }

    const token = await this.prisma.userToken.findFirst({
      where: {
        userId: user.id,
        type: UserTokenType.PASSWORD_RESET,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!token || token.expiresAt <= now || (token.blockedUntil && token.blockedUntil > now)) {
      throw createRecoveryError();
    }

    const suppliedHash = hashSecret(code, this.config.tokenPepper, `recovery:${token.id}`);

    if (!safelyEqualHash(suppliedHash, token.tokenHash)) {
      const failedAttempts = token.failedAttempts + 1;
      await this.prisma.userToken.update({
        where: { id: token.id },
        data: {
          failedAttempts,
          blockedUntil:
            failedAttempts >= this.config.maxRecoveryAttempts
              ? new Date(now.getTime() + this.config.recoveryBlockMinutes * 60_000)
              : token.blockedUntil
        }
      });
      throw createRecoveryError();
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.prisma.$transaction(async (database) => {
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.passwordRecoveryCodeValidated,
          actorUserId: user.id,
          entityType: 'UserToken',
          entityId: token.id,
          request: context.request
        },
        database
      );
      await database.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          blockedUntil: null,
          failedLoginAttempts: 0,
          loginFailureWindowStartedAt: null
        }
      });
      await database.userToken.update({
        where: { id: token.id },
        data: {
          consumedAt: now
        }
      });
      await database.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revocationReason: 'PASSWORD_RESET'
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.passwordReset,
          actorUserId: user.id,
          entityType: 'User',
          entityId: user.id,
          request: context.request
        },
        database
      );
    });
  }

  public async assertCsrf(request: RequestWithPrincipal, sessionId: string): Promise<void> {
    const csrfCookie = this.readCookie(request, this.config.csrfCookieName);
    const csrfHeader = request.header('x-csrf-token');

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new BadRequestException({
        code: 'CSRF_VALIDATION_FAILED',
        message: 'A validação de segurança da solicitação falhou.'
      });
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: {
        csrfTokenHash: true
      }
    });
    const suppliedHash = hashSecret(csrfHeader, this.config.tokenPepper, `csrf:${sessionId}`);

    if (!session || !safelyEqualHash(suppliedHash, session.csrfTokenHash)) {
      throw new BadRequestException({
        code: 'CSRF_VALIDATION_FAILED',
        message: 'A validação de segurança da solicitação falhou.'
      });
    }
  }

  public async assertRefreshCsrf(
    request: RequestWithPrincipal,
    refreshToken: string | undefined
  ): Promise<void> {
    const parsed = this.parseRefreshToken(refreshToken);

    if (!parsed) {
      throw createAuthenticationError();
    }

    await this.assertCsrf(request, parsed.sessionId);
  }

  public async authenticateAccessToken(
    accessToken: string | undefined
  ): Promise<AuthenticatedPrincipal> {
    if (!accessToken) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Entre novamente para continuar.'
      });
    }

    const claims = this.accessTokens.verify(accessToken);
    const session = await this.prisma.userSession.findUnique({
      where: { id: claims.sid },
      include: {
        user: {
          include: AUTH_USER_INCLUDE
        }
      }
    });
    const now = new Date();

    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.user.emailVerifiedAt ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sua sessão não é válida ou expirou.'
      });
    }

    if (this.isInactive(session.lastActivityAt, now)) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: {
          revokedAt: now,
          revocationReason: 'INACTIVITY_TIMEOUT'
        }
      });
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Sua sessão expirou por inatividade.'
      });
    }

    if (now.getTime() - session.lastActivityAt.getTime() >= 60_000) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: {
          lastActivityAt: now
        }
      });
    }

    return this.toPrincipal(session.user, session.id, now, session.mfaVerifiedAt);
  }

  public readCookie(request: RequestWithPrincipal, name: string): string | undefined {
    return readCookies(request.header('cookie'))[name];
  }

  public isInactive(lastActivityAt: Date, now: Date): boolean {
    return now.getTime() - lastActivityAt.getTime() > this.config.inactivityMinutes * 60_000;
  }

  private async recordFailedLogin(
    userId: string,
    now: Date,
    request: RequestWithPrincipal
  ): Promise<void> {
    await this.prisma.$transaction(
      async (database) => {
        await database.$queryRaw`
          SELECT "id"
          FROM "users"
          WHERE "id" = ${userId}::uuid
          FOR UPDATE
        `;
        const current = await database.user.findUniqueOrThrow({
          where: { id: userId }
        });
        const windowIsActive =
          current.loginFailureWindowStartedAt !== null &&
          now.getTime() - current.loginFailureWindowStartedAt.getTime() <=
            this.config.loginFailureWindowMinutes * 60_000;
        const attempts = windowIsActive ? current.failedLoginAttempts + 1 : 1;
        const temporarilyBlocked = attempts >= this.config.maxLoginAttempts;

        await database.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: attempts,
            loginFailureWindowStartedAt: windowIsActive ? current.loginFailureWindowStartedAt : now,
            blockedUntil: temporarilyBlocked
              ? new Date(now.getTime() + this.config.loginBlockMinutes * 60_000)
              : null
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.loginFailed,
            entityType: 'User',
            entityId: userId,
            reason: temporarilyBlocked ? 'TEMPORARY_BLOCK_APPLIED' : 'INVALID_CREDENTIALS',
            metadata: {
              temporaryBlockApplied: temporarilyBlocked
            },
            request
          },
          database
        );
      },
      {
        isolationLevel: 'Serializable'
      }
    );
  }

  private activeRoleCodes(
    user: {
      readonly userRoles: readonly {
        readonly expiresAt: Date | null;
        readonly role: {
          readonly code: string;
          readonly deletedAt: Date | null;
        };
      }[];
    },
    now: Date
  ): readonly string[] {
    return user.userRoles
      .filter(({ expiresAt, role }) => !role.deletedAt && (!expiresAt || expiresAt > now))
      .map(({ role }) => role.code);
  }

  private createSessionMaterial(input: {
    readonly userId: string;
    readonly now: Date;
    readonly mfaVerifiedAt: Date | null;
    readonly rotatedFromSessionId?: string;
    readonly absoluteExpiresAt?: Date;
  }) {
    const sessionId = randomUUID();
    const refreshSecret = createOpaqueSecret();
    const csrfToken = createOpaqueSecret();
    const absoluteExpiresAt =
      input.absoluteExpiresAt ??
      new Date(input.now.getTime() + this.config.sessionAbsoluteDays * 24 * 60 * 60_000);

    return {
      refreshToken: `${sessionId}.${refreshSecret}`,
      csrfToken,
      sessionData: {
        id: sessionId,
        userId: input.userId,
        refreshTokenHash: hashSecret(
          refreshSecret,
          this.config.tokenPepper,
          `refresh:${sessionId}`
        ),
        csrfTokenHash: hashSecret(csrfToken, this.config.tokenPepper, `csrf:${sessionId}`),
        rotatedFromSessionId: input.rotatedFromSessionId ?? null,
        createdAt: input.now,
        lastActivityAt: input.now,
        expiresAt: absoluteExpiresAt,
        absoluteExpiresAt,
        mfaVerifiedAt: input.mfaVerifiedAt
      }
    };
  }

  private parseRefreshToken(
    token: string | undefined
  ): { readonly sessionId: string; readonly secret: string } | undefined {
    if (!token) {
      return undefined;
    }

    const separatorIndex = token.indexOf('.');

    if (separatorIndex < 1 || token.indexOf('.', separatorIndex + 1) !== -1) {
      return undefined;
    }

    return {
      sessionId: token.slice(0, separatorIndex),
      secret: token.slice(separatorIndex + 1)
    };
  }

  private toPrincipal(
    user: {
      readonly id: string;
      readonly name: string;
      readonly email: string;
      readonly emailVerifiedAt: Date | null;
      readonly mfaCredential: {
        readonly confirmedAt: Date | null;
      } | null;
      readonly userRoles: readonly {
        readonly expiresAt: Date | null;
        readonly role: {
          readonly code: string;
          readonly deletedAt: Date | null;
          readonly rolePermissions: readonly {
            readonly permission: {
              readonly code: string;
              readonly deletedAt: Date | null;
            };
          }[];
        };
      }[];
    },
    sessionId: string,
    now: Date,
    mfaVerifiedAt: Date | null
  ): AuthenticatedPrincipal {
    const activeRoles = user.userRoles.filter(
      ({ expiresAt, role }) => !role.deletedAt && (!expiresAt || expiresAt > now)
    );

    return {
      userId: user.id,
      sessionId,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      mfaEnabled: user.mfaCredential?.confirmedAt !== null && user.mfaCredential !== null,
      mfaVerified: mfaVerifiedAt !== null,
      mfaEnrollmentRequired:
        this.mfa.isRequiredForRoles(activeRoles.map(({ role }) => role.code)) &&
        user.mfaCredential?.confirmedAt == null,
      roles: [...new Set(activeRoles.map(({ role }) => role.code))],
      permissions: [
        ...new Set(
          activeRoles.flatMap(({ role }) =>
            role.rolePermissions
              .filter(({ permission }) => !permission.deletedAt)
              .map(({ permission }) => permission.code)
          )
        )
      ]
    };
  }
}
