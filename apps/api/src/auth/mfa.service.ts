import { randomBytes, randomUUID } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common';
import { type Prisma, UserTokenType } from '@prisma/client';
import QRCode from 'qrcode';

import { ROLE_CODES } from '../access-control/access.constants';
import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import { createOpaqueSecret, hashSecret, safelyEqualHash } from '../common/security/security';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { AuthConfig } from './auth.config';
import { MfaCryptoService } from './mfa-crypto.service';
import { PasswordHasherService } from './password-hasher.service';
import { TotpService } from './totp.service';

const MFA_REQUIRED_ROLES = new Set<string>([
  ROLE_CODES.administrator,
  ROLE_CODES.board,
  ROLE_CODES.finance,
  ROLE_CODES.treasurer,
  ROLE_CODES.financeAssistant
]);

type MfaDatabaseClient = Prisma.TransactionClient;

interface MfaCredentialView {
  readonly id: string;
  readonly secretCiphertext: string;
  readonly secretIv: string;
  readonly secretAuthTag: string;
  readonly keyVersion: string;
  readonly lastTotpStep: number | null;
  readonly confirmedAt: Date | null;
}

function invalidMfaChallenge(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_MFA_CHALLENGE',
    message: 'O desafio MFA não é válido, expirou ou já foi utilizado.'
  });
}

function invalidMfaCode(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_MFA_CODE',
    message: 'O código MFA não é válido ou já foi utilizado.'
  });
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/gu, '').toUpperCase();
}

@Injectable()
export class MfaService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: AuthConfig,
    private readonly crypto: MfaCryptoService,
    private readonly totp: TotpService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordHasherService,
    private readonly email: EmailService
  ) {}

  public isRequiredForRoles(roles: readonly string[]): boolean {
    return roles.some((role) => MFA_REQUIRED_ROLES.has(role));
  }

  public async hasActiveCredential(userId: string): Promise<boolean> {
    const credential = await this.prisma.mfaCredential.findUnique({
      where: { userId },
      select: { confirmedAt: true }
    });

    return credential?.confirmedAt !== null && credential?.confirmedAt !== undefined;
  }

  public async createLoginChallenge(userId: string): Promise<{
    readonly challengeToken: string;
    readonly expiresAt: Date;
  }> {
    const now = new Date();
    const id = randomUUID();
    const secret = createOpaqueSecret();
    const expiresAt = new Date(now.getTime() + this.config.mfaChallengeMinutes * 60_000);

    await this.prisma.$transaction(async (database) => {
      await database.userToken.updateMany({
        where: {
          userId,
          type: UserTokenType.MFA_LOGIN_CHALLENGE,
          consumedAt: null
        },
        data: { consumedAt: now }
      });
      await database.userToken.create({
        data: {
          id,
          userId,
          type: UserTokenType.MFA_LOGIN_CHALLENGE,
          tokenHash: hashSecret(secret, this.config.tokenPepper, `mfa-challenge:${id}`),
          expiresAt
        }
      });
    });

    return {
      challengeToken: `${id}.${secret}`,
      expiresAt
    };
  }

  public async verifyLoginChallenge(
    challengeToken: string,
    code: string,
    request: RequestWithPrincipal
  ): Promise<string> {
    const parsed = this.parseChallenge(challengeToken);
    const now = new Date();

    if (!parsed) {
      throw invalidMfaChallenge();
    }

    return this.prisma.$transaction(
      async (database) => {
        const token = await database.userToken.findUnique({
          where: { id: parsed.id },
          include: {
            user: {
              include: {
                mfaCredential: true
              }
            }
          }
        });
        const suppliedHash = hashSecret(
          parsed.secret,
          this.config.tokenPepper,
          `mfa-challenge:${parsed.id}`
        );

        if (
          !token ||
          token.type !== UserTokenType.MFA_LOGIN_CHALLENGE ||
          token.consumedAt ||
          token.expiresAt <= now ||
          !safelyEqualHash(suppliedHash, token.tokenHash) ||
          !token.user.mfaCredential?.confirmedAt
        ) {
          throw invalidMfaChallenge();
        }

        const factor = await this.verifySecondFactor(
          database,
          token.user.mfaCredential,
          token.userId,
          code,
          now
        );

        if (!factor) {
          const failedAttempts = token.failedAttempts + 1;

          await database.userToken.update({
            where: { id: token.id },
            data: {
              failedAttempts,
              ...(failedAttempts >= this.config.maxRecoveryAttempts
                ? {
                    consumedAt: now
                  }
                : {})
            }
          });
          await this.audit.record(
            {
              action: AUDIT_ACTIONS.mfaChallengeFailed,
              actorUserId: token.userId,
              entityType: 'UserToken',
              entityId: token.id,
              request
            },
            database
          );
          throw invalidMfaCode();
        }

        await database.userToken.update({
          where: { id: token.id },
          data: { consumedAt: now }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.mfaChallengeSucceeded,
            actorUserId: token.userId,
            entityType: 'User',
            entityId: token.userId,
            metadata: {
              factorType: factor
            },
            request
          },
          database
        );

        return token.userId;
      },
      {
        isolationLevel: 'Serializable'
      }
    );
  }

  public async beginEnrollment(
    principal: AuthenticatedPrincipal,
    request: RequestWithPrincipal
  ): Promise<{
    readonly secret: string;
    readonly otpAuthUri: string;
    readonly qrCodeDataUrl: string;
  }> {
    const existing = await this.prisma.mfaCredential.findUnique({
      where: { userId: principal.userId }
    });

    if (existing?.confirmedAt) {
      throw new ConflictException({
        code: 'MFA_ALREADY_ENABLED',
        message: 'O MFA já está ativo para esta conta.'
      });
    }

    const secret = this.totp.createSecret();
    const encrypted = this.crypto.encrypt(secret, principal.userId);
    const otpAuthUri = this.totp.buildOtpAuthUri(secret, principal.email);

    await this.prisma.$transaction(async (database) => {
      await database.mfaCredential.upsert({
        where: { userId: principal.userId },
        create: {
          userId: principal.userId,
          ...encrypted
        },
        update: {
          ...encrypted,
          confirmedAt: null,
          lastTotpStep: null
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.mfaEnrollmentStarted,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: principal.userId,
          request
        },
        database
      );
    });

    return {
      secret,
      otpAuthUri,
      qrCodeDataUrl: await QRCode.toDataURL(otpAuthUri, {
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 256
      })
    };
  }

  public async confirmEnrollment(
    principal: AuthenticatedPrincipal,
    code: string,
    request: RequestWithPrincipal
  ): Promise<{ readonly recoveryCodes: readonly string[] }> {
    const now = new Date();
    const recoveryCodes = Array.from({ length: this.config.mfaRecoveryCodeCount }, () =>
      this.createRecoveryCode()
    );

    await this.prisma.$transaction(
      async (database) => {
        const credential = await database.mfaCredential.findUnique({
          where: { userId: principal.userId }
        });

        if (!credential || credential.confirmedAt) {
          throw new ConflictException({
            code: 'MFA_ENROLLMENT_NOT_PENDING',
            message: 'Não existe uma configuração MFA aguardando confirmação.'
          });
        }

        await this.lockCredential(database, credential.id);
        const secret = this.crypto.decrypt(credential, principal.userId);
        const matchedStep = this.totp.verify(secret, code, now);

        if (matchedStep === undefined) {
          throw invalidMfaCode();
        }

        await database.mfaRecoveryCode.deleteMany({
          where: { credentialId: credential.id }
        });
        await database.mfaCredential.update({
          where: { id: credential.id },
          data: {
            confirmedAt: now,
            lastTotpStep: matchedStep
          }
        });
        await database.mfaRecoveryCode.createMany({
          data: recoveryCodes.map((recoveryCode) => ({
            credentialId: credential.id,
            codeHash: hashSecret(
              normalizeRecoveryCode(recoveryCode),
              this.config.tokenPepper,
              `mfa-recovery:${credential.id}`
            )
          }))
        });
        await database.userSession.update({
          where: { id: principal.sessionId },
          data: { mfaVerifiedAt: now }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.mfaEnabled,
            actorUserId: principal.userId,
            entityType: 'User',
            entityId: principal.userId,
            request
          },
          database
        );
      },
      {
        isolationLevel: 'Serializable'
      }
    );

    void this.email
      .sendSecurityAlert(principal.email, 'A autenticação em dois fatores foi ativada.')
      .catch(() => undefined);

    return { recoveryCodes };
  }

  public async disable(
    principal: AuthenticatedPrincipal,
    password: string,
    code: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    if (this.isRequiredForRoles(principal.roles)) {
      throw new ConflictException({
        code: 'MFA_REQUIRED_FOR_ROLE',
        message: 'Remova primeiro os papéis que exigem MFA antes de desativá-lo.'
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      include: { mfaCredential: true }
    });
    const passwordMatches = user ? await this.passwords.verify(password, user.passwordHash) : false;

    if (!user || !passwordMatches || !user.mfaCredential?.confirmedAt) {
      throw new UnauthorizedException({
        code: 'REAUTHENTICATION_FAILED',
        message: 'A reautenticação não foi concluída.'
      });
    }

    const now = new Date();

    await this.prisma.$transaction(
      async (database) => {
        await this.lockCredential(database, user.mfaCredential!.id);
        const factor = await this.verifySecondFactor(
          database,
          user.mfaCredential!,
          user.id,
          code,
          now
        );

        if (!factor) {
          throw invalidMfaCode();
        }

        await database.mfaCredential.delete({
          where: { id: user.mfaCredential!.id }
        });
        await database.userSession.updateMany({
          where: {
            userId: user.id,
            revokedAt: null
          },
          data: {
            revokedAt: now,
            revocationReason: 'MFA_DISABLED'
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.mfaDisabled,
            actorUserId: user.id,
            entityType: 'User',
            entityId: user.id,
            request
          },
          database
        );
      },
      {
        isolationLevel: 'Serializable'
      }
    );

    void this.email
      .sendSecurityAlert(user.email, 'A autenticação em dois fatores foi desativada.')
      .catch(() => undefined);
  }

  public async resetByAdministrator(
    targetUserId: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(
      async (database) => {
        await database.$queryRaw`SELECT pg_advisory_xact_lock(117894584, 2)`;
        const target = await database.user.findUnique({
          where: { id: targetUserId },
          include: {
            mfaCredential: true,
            userRoles: {
              include: { role: true }
            }
          }
        });

        if (!target?.mfaCredential) {
          return;
        }

        const isAdministrator = target.userRoles.some(
          ({ role }) => role.code === ROLE_CODES.administrator && !role.deletedAt
        );

        if (isAdministrator) {
          const otherSecureAdministrators = await database.user.count({
            where: {
              id: { not: targetUserId },
              status: 'ACTIVE',
              deletedAt: null,
              mfaCredential: {
                confirmedAt: { not: null }
              },
              userRoles: {
                some: {
                  role: {
                    code: ROLE_CODES.administrator,
                    deletedAt: null
                  }
                }
              }
            }
          });

          if (otherSecureAdministrators === 0) {
            throw new ConflictException({
              code: 'LAST_SECURE_ADMINISTRATOR_REQUIRED',
              message: 'O MFA do último administrador seguro não pode ser redefinido.'
            });
          }
        }

        await database.mfaCredential.delete({
          where: { id: target.mfaCredential.id }
        });
        await database.userSession.updateMany({
          where: {
            userId: targetUserId,
            revokedAt: null
          },
          data: {
            revokedAt: now,
            revocationReason: 'MFA_ADMIN_RESET'
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.mfaAdminReset,
            actorUserId,
            entityType: 'User',
            entityId: targetUserId,
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

  private async verifySecondFactor(
    database: MfaDatabaseClient,
    credential: MfaCredentialView,
    userId: string,
    code: string,
    now: Date
  ): Promise<'TOTP' | 'RECOVERY' | undefined> {
    await this.lockCredential(database, credential.id);
    const secret = this.crypto.decrypt(credential, userId);
    const matchedStep = this.totp.verify(secret, code, now, credential.lastTotpStep);

    if (matchedStep !== undefined) {
      await database.mfaCredential.update({
        where: { id: credential.id },
        data: { lastTotpStep: matchedStep }
      });

      return 'TOTP';
    }

    const codeHash = hashSecret(
      normalizeRecoveryCode(code),
      this.config.tokenPepper,
      `mfa-recovery:${credential.id}`
    );
    const recoveryCode = await database.mfaRecoveryCode.findUnique({
      where: { codeHash }
    });

    if (!recoveryCode || recoveryCode.credentialId !== credential.id || recoveryCode.usedAt) {
      return undefined;
    }

    await database.mfaRecoveryCode.update({
      where: { id: recoveryCode.id },
      data: { usedAt: now }
    });
    await this.audit.record(
      {
        action: AUDIT_ACTIONS.mfaRecoveryCodeUsed,
        actorUserId: userId,
        entityType: 'User',
        entityId: userId
      },
      database
    );

    return 'RECOVERY';
  }

  private async lockCredential(database: MfaDatabaseClient, credentialId: string): Promise<void> {
    await database.$queryRaw`
      SELECT "id"
      FROM "mfa_credentials"
      WHERE "id" = ${credentialId}::uuid
      FOR UPDATE
    `;
  }

  private createRecoveryCode(): string {
    return randomBytes(8)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/gu)!
      .join('-');
  }

  private parseChallenge(
    challenge: string
  ): { readonly id: string; readonly secret: string } | undefined {
    const separator = challenge.indexOf('.');

    if (separator <= 0 || challenge.indexOf('.', separator + 1) !== -1) {
      return undefined;
    }

    return {
      id: challenge.slice(0, separator),
      secret: challenge.slice(separator + 1)
    };
  }
}
