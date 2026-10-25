import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { REVOCATION } from '../domain/auth-rules';

export interface ProfileView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly athleteId: string | null;
  readonly createdAt: string;
  /** Segunda etapa: `required` para perfis privilegiados; `verified` nesta sessão (DT-037). */
  readonly mfa: {
    readonly enabled: boolean;
    readonly required: boolean;
    readonly verified: boolean;
  };
}

export interface SessionView {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}

/** Perfil e sessões do próprio usuário (recurso "Próprio" da matriz). */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async profile(principal: Principal): Promise<ProfileView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        mfaEnabledAt: true,
        athlete: { select: { id: true, deletedAt: true } }
      }
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: principal.roles,
      permissions: [...principal.permissions].sort(),
      athleteId: user.athlete && user.athlete.deletedAt === null ? user.athlete.id : null,
      createdAt: user.createdAt.toISOString(),
      mfa: {
        enabled: user.mfaEnabledAt !== null,
        required: principal.privileged,
        verified: principal.mfaVerified
      }
    };
  }

  async updateProfile(
    principal: Principal,
    input: { name?: string; phone?: string },
    meta: RequestMeta
  ): Promise<ProfileView> {
    const before = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { name: true, phone: true }
    });
    const data = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.phone === undefined ? {} : { phone: input.phone.trim() || null })
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: principal.userId }, data });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'user.profile.updated',
          entityType: 'User',
          entityId: principal.userId,
          before,
          after: data,
          meta
        },
        tx
      );
    });

    return this.profile(principal);
  }

  async sessions(principal: Principal): Promise<SessionView[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId: principal.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true }
    });

    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === principal.sessionId
    }));
  }

  async revokeSession(principal: Principal, sessionId: string, meta: RequestMeta): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId: principal.userId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: REVOCATION.revokedByUser }
    });

    if (result.count === 0) {
      throw AppError.notFound('Sessão não encontrada.');
    }

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'auth.session.revoked',
      entityType: 'UserSession',
      entityId: sessionId,
      meta
    });
  }
}
