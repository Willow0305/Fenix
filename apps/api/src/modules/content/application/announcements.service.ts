import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  BROADCAST_AUDIENCE_LABELS,
  type BroadcastAudience,
  sanitizeText
} from '../domain/content-rules';
import { assertActiveTeam } from '../../sports/application/active-team';

export interface BroadcastInput {
  readonly audience: BroadcastAudience;
  readonly teamId?: string;
  readonly title: string;
  readonly message: string;
  readonly link?: string;
}

export interface BroadcastResult {
  readonly recipients: number;
  readonly delivered: number;
  readonly replayed: boolean;
}

export interface BroadcastHistoryItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: string | null;
  readonly audience: string;
  readonly title: string;
  readonly recipients: number;
}

const MAX_RECIPIENTS = 5_000;

/**
 * Avisos manuais da diretoria a grupos (RF-022, RN-COM-007). Somente in-app nesta versão
 * (PEN-040); idempotente pela chave do envio: reenvio não notifica ninguém de novo.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  private async recipients(input: BroadcastInput): Promise<string[]> {
    if (input.audience === 'STAFF') {
      return this.notifications.permissionHolders(
        PERMISSIONS.dashboardRead,
        undefined,
        MAX_RECIPIENTS
      );
    }

    if (input.audience === 'ALL_USERS') {
      const users = await this.prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
        take: MAX_RECIPIENTS
      });

      return users.map((user) => user.id);
    }

    if (input.audience === 'TEAM' && !input.teamId) {
      throw AppError.validation('TEAM_REQUIRED', 'Escolha a equipe.');
    }

    if (input.audience === 'TEAM') {
      await assertActiveTeam(this.prisma, input.teamId);
    }

    const athletes = await this.prisma.athlete.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        userId: { not: null },
        user: { status: 'ACTIVE' },
        ...(input.audience === 'TEAM'
          ? {
              teamMemberships: {
                some: { teamId: input.teamId as string, status: 'ACTIVE', endsOn: null }
              }
            }
          : {})
      },
      select: { userId: true },
      take: MAX_RECIPIENTS
    });

    return [...new Set(athletes.map((a) => a.userId).filter((id): id is string => id !== null))];
  }

  async broadcast(
    actor: Principal,
    input: BroadcastInput,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<BroadcastResult> {
    const deduplicationKey = `broadcast:${idempotencyKey}`;
    const previous = await this.prisma.notification.count({ where: { deduplicationKey } });

    if (previous > 0) {
      return { recipients: previous, delivered: 0, replayed: true };
    }

    if (input.link && !/^\/(?!\/)[\w\-./?=&#%]*$/.test(input.link)) {
      throw AppError.validation(
        'INVALID_LINK',
        'Use um link interno do site, começando com "/" (ex.: /eventos).'
      );
    }

    const title = sanitizeText(input.title);
    const message = sanitizeText(input.message);
    const userIds = await this.recipients(input);

    if (userIds.length === 0) {
      throw AppError.validation('NO_RECIPIENTS', 'Nenhum destinatário encontrado para este grupo.');
    }

    let delivered = 0;

    for (let index = 0; index < userIds.length; index += 500) {
      delivered += await this.notifications.notify(
        userIds.slice(index, index + 500).map((userId) => ({
          userId,
          type: 'announcement',
          title,
          message,
          ...(input.link ? { link: input.link } : {}),
          deduplicationKey
        }))
      );
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'notification.broadcast',
      entityType: 'Notification',
      after: {
        audience: input.audience,
        teamId: input.teamId ?? null,
        title,
        recipients: userIds.length,
        delivered
      },
      metadata: { idempotencyKey },
      meta
    });

    return { recipients: userIds.length, delivered, replayed: false };
  }

  async history(): Promise<BroadcastHistoryItem[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { action: 'notification.broadcast' },
      include: { actorUser: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 50
    });

    return rows.map((row) => {
      const after = (row.afterData ?? {}) as {
        audience?: BroadcastAudience;
        title?: string;
        recipients?: number;
      };

      return {
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        actor: row.actorUser?.name ?? null,
        audience: after.audience ? BROADCAST_AUDIENCE_LABELS[after.audience] : '—',
        title: after.title ?? '',
        recipients: after.recipients ?? 0
      };
    });
  }
}
