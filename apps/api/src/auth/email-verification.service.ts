import { randomUUID } from 'node:crypto';

import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { UserStatus, UserTokenType } from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import {
  createNumericCode,
  hashSecret,
  normalizeEmail,
  safelyEqualHash
} from '../common/security/security';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AuthConfig } from './auth.config';

function invalidVerificationCode(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_EMAIL_VERIFICATION_CODE',
    message: 'O código não é válido, expirou ou já foi utilizado.'
  });
}

@Injectable()
export class EmailVerificationService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: AuthConfig,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly rateLimits: RateLimitService
  ) {}

  public async request(emailInput: string, request?: RequestWithPrincipal): Promise<void> {
    const normalizedEmail = normalizeEmail(emailInput);
    const accountLimit = await this.rateLimits.consume(
      'emailVerificationResend',
      `account:${normalizedEmail}`
    );

    if (!accountLimit.allowed) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (
      !user ||
      user.deletedAt ||
      user.emailVerifiedAt ||
      (user.status !== UserStatus.PENDING && user.status !== UserStatus.ACTIVE)
    ) {
      return;
    }

    const latest = await this.prisma.userToken.findFirst({
      where: {
        userId: user.id,
        type: UserTokenType.EMAIL_VERIFICATION,
        consumedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });
    const now = new Date();

    if (
      latest &&
      now.getTime() - latest.createdAt.getTime() < this.config.emailVerificationResendSeconds * 1000
    ) {
      return;
    }

    const tokenId = randomUUID();
    const code = createNumericCode(8);
    const expiresAt = new Date(now.getTime() + this.config.emailVerificationHours * 60 * 60_000);

    await this.prisma.$transaction(async (database) => {
      await database.userToken.updateMany({
        where: {
          userId: user.id,
          type: UserTokenType.EMAIL_VERIFICATION,
          consumedAt: null
        },
        data: { consumedAt: now }
      });
      await database.userToken.create({
        data: {
          id: tokenId,
          userId: user.id,
          type: UserTokenType.EMAIL_VERIFICATION,
          tokenHash: hashSecret(code, this.config.tokenPepper, `email-verification:${tokenId}`),
          expiresAt
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.emailVerificationRequested,
          entityType: 'UserToken',
          entityId: tokenId,
          ...(request ? { request } : {})
        },
        database
      );
    });

    try {
      await this.email.sendEmailVerification(user.email, code, this.config.emailVerificationHours);
    } catch {
      await this.prisma.userToken.update({
        where: { id: tokenId },
        data: { consumedAt: new Date() }
      });
    }
  }

  public async verify(
    emailInput: string,
    code: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const normalizedEmail = normalizeEmail(emailInput);
    const accountLimit = await this.rateLimits.consume(
      'codeValidation',
      `email-verification:${normalizedEmail}`
    );

    if (!accountLimit.allowed) {
      throw invalidVerificationCode();
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    const now = new Date();

    if (!user || user.deletedAt) {
      hashSecret(code, this.config.tokenPepper, 'email-verification:unknown');
      throw invalidVerificationCode();
    }

    if (user.emailVerifiedAt) {
      return;
    }

    const token = await this.prisma.userToken.findFirst({
      where: {
        userId: user.id,
        type: UserTokenType.EMAIL_VERIFICATION,
        consumedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!token || token.expiresAt <= now || (token.blockedUntil && token.blockedUntil > now)) {
      throw invalidVerificationCode();
    }

    const suppliedHash = hashSecret(
      code,
      this.config.tokenPepper,
      `email-verification:${token.id}`
    );

    if (!safelyEqualHash(suppliedHash, token.tokenHash)) {
      const failedAttempts = token.failedAttempts + 1;

      await this.prisma.userToken.update({
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
      throw invalidVerificationCode();
    }

    await this.prisma.$transaction(async (database) => {
      await database.userToken.update({
        where: { id: token.id },
        data: { consumedAt: now }
      });
      await database.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: now,
          ...(user.status === UserStatus.PENDING
            ? {
                status: UserStatus.ACTIVE
              }
            : {})
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.emailVerified,
          actorUserId: user.id,
          entityType: 'User',
          entityId: user.id,
          request
        },
        database
      );
    });
  }
}
