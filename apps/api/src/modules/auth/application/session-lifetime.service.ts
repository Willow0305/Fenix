import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import type { RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  REVOCATION,
  type SessionLifetimeState,
  type SessionLimits,
  sessionLimitsFor
} from '../domain/auth-rules';

type SessionClient = PrismaService | PrismaTx;

/** Persistência dos limites de sessão por inatividade e duração total (DT-036). */
@Injectable()
export class SessionLifetimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Limites conforme as permissões vigentes do usuário (papéis expirados não contam). */
  async limitsForUser(
    userId: string,
    now: Date,
    client: SessionClient = this.prisma
  ): Promise<SessionLimits> {
    const rows = await client.rolePermission.findMany({
      where: {
        permission: { deletedAt: null },
        role: {
          deletedAt: null,
          userRoles: {
            some: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
          }
        }
      },
      select: { permission: { select: { code: true } } }
    });

    return sessionLimitsFor(rows.map((row) => row.permission.code));
  }

  /** Revoga a sessão vencida e registra o motivo; idempotente se já estiver revogada. */
  async expire(
    session: { readonly id: string; readonly userId: string },
    state: Exclude<SessionLifetimeState, 'ACTIVE'>,
    meta: RequestMeta | null
  ): Promise<void> {
    const reason = state === 'IDLE_TIMEOUT' ? REVOCATION.idleTimeout : REVOCATION.absoluteTimeout;
    const result = await this.prisma.userSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason }
    });

    if (result.count === 1) {
      await this.audit.record({
        actorUserId: session.userId,
        action: 'auth.session.expired',
        entityType: 'UserSession',
        entityId: session.id,
        metadata: { reason },
        meta
      });
    }
  }

  /** Marca uso real, gravando no máximo uma vez por intervalo para poupar o banco. */
  async touch(sessionId: string, now: Date, writeIntervalSeconds: number): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        lastActivityAt: { lt: new Date(now.getTime() - writeIntervalSeconds * 1000) }
      },
      data: { lastActivityAt: now }
    });
  }
}
