import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { categoryOf, channelsFor, whatsappNumber } from '../domain/channel-rules';
import { DeliveryService, recipientPhone } from './delivery.service';

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

/**
 * Notificações (RF-022, RN-COM-007). Toda notificação aparece no painel; conforme a
 * finalidade e a escolha da pessoa, também entra na fila de e-mail e WhatsApp (DT-048).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryService
  ) {}

  async notify(inputs: NotifyInput | readonly NotifyInput[], tx?: PrismaTx): Promise<number> {
    const list = Array.isArray(inputs) ? inputs : [inputs as NotifyInput];

    if (list.length === 0) {
      return 0;
    }

    const db = tx ?? this.prisma;
    // Ids gerados aqui identificam o que foi criado agora; duplicados são ignorados.
    const rows = list.map((input) => ({ id: randomUUID(), input }));
    const result = await db.notification.createMany({
      data: rows.map(({ id, input }) => ({
        id,
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

    if (
      result.count > 0 &&
      (await this.enqueue(
        db,
        rows.map((row) => row.id)
      )) > 0
    ) {
      this.delivery.kick();
    }

    return result.count;
  }

  /** Coloca na fila os envios externos das notificações recém-criadas. */
  private async enqueue(db: PrismaTx | PrismaService, ids: readonly string[]): Promise<number> {
    const created = await db.notification.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        type: true,
        user: {
          select: {
            email: true,
            phone: true,
            status: true,
            deletedAt: true,
            whatsappOptInAt: true,
            athlete: { select: { phone: true } },
            notificationPreferences: { select: { category: true, channel: true, enabled: true } }
          }
        }
      }
    });
    const available = this.delivery.availableChannels();
    const data = created.flatMap(({ id, type, user }) => {
      if (user.status !== 'ACTIVE' || user.deletedAt) {
        return [];
      }

      const channels = channelsFor(
        categoryOf(type),
        user.notificationPreferences,
        {
          email: user.email,
          whatsapp: whatsappNumber(recipientPhone(user)),
          whatsappOptIn: user.whatsappOptInAt !== null
        },
        available
      );

      return channels.map((channel) => ({ notificationId: id, channel }));
    });

    if (data.length === 0) {
      return 0;
    }

    return (await db.notificationDelivery.createMany({ data, skipDuplicates: true })).count;
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
