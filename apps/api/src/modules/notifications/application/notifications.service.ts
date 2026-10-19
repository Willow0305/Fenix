import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';

export interface NotifyInput {
  readonly userId: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  /** Link interno relativo exibido na notificação, sem dados pessoais. */
  readonly link?: string;
  /** Chave idempotente: o mesmo evento nunca gera duas notificações ao mesmo usuário. */
  readonly deduplicationKey: string;
}

export interface NotificationView {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly link: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

/** Notificações internas (RF-022, RN-COM-007). */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(inputs: NotifyInput | readonly NotifyInput[], tx?: PrismaTx): Promise<number> {
    const list = Array.isArray(inputs) ? inputs : [inputs as NotifyInput];

    if (list.length === 0) {
      return 0;
    }

    const result = await (tx ?? this.prisma).notification.createMany({
      data: list.map((input) => ({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        channel: 'IN_APP' as const,
        deliveryStatus: 'SENT' as const,
        sentAt: new Date(),
        payload: (input.link ? { link: input.link } : {}) as Prisma.InputJsonValue,
        deduplicationKey: input.deduplicationKey
      })),
      skipDuplicates: true
    });

    return result.count;
  }

  /** Usuários ativos que têm a permissão por algum papel vigente (destinatários operacionais). */
  async permissionHolders(permission: string, tx?: PrismaTx, limit = 50): Promise<string[]> {
    const now = new Date();
    const users = await (tx ?? this.prisma).user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        userRoles: {
          some: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            role: {
              deletedAt: null,
              rolePermissions: { some: { permission: { code: permission, deletedAt: null } } }
            }
          }
        }
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    return users.map((user) => user.id);
  }

  async list(
    userId: string,
    query: PageQueryDto & { unread?: boolean }
  ): Promise<Page<NotificationView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.NotificationWhereInput = {
      userId,
      deletedAt: null,
      ...(query.unread ? { readAt: null } : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.notification.count({ where })
    ]);

    return toPage(
      rows.map((row) => {
        const payload = row.payload as { link?: unknown } | null;

        return {
          id: row.id,
          type: row.type,
          title: row.title,
          message: row.message,
          link: typeof payload?.link === 'string' ? payload.link : null,
          readAt: row.readAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString()
        };
      }),
      total,
      page,
      pageSize
    );
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null, deletedAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, deletedAt: null },
      data: { readAt: new Date() }
    });

    if (result.count === 0) {
      throw AppError.notFound('Notificação não encontrada.');
    }
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, deletedAt: null },
      data: { readAt: new Date() }
    });

    return result.count;
  }
}
