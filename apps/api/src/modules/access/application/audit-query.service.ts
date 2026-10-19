import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface AuditLogView {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly reason: string | null;
  readonly actor: { readonly id: string; readonly name: string } | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly metadata: unknown;
  readonly requestId: string | null;
}

export interface AuditFilters extends PageQueryDto {
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorUserId?: string;
  readonly action?: string;
  readonly from?: string;
  readonly to?: string;
}

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: AuditFilters): Promise<Page<AuditLogView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      ...(filters.action ? { action: { startsWith: filters.action } } : {}),
      ...(filters.from || filters.to
        ? {
            occurredAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {})
            }
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take,
        include: { actorUser: { select: { id: true, name: true } } }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return toPage(
      rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        reason: row.reason,
        actor: row.actorUser,
        before: row.beforeData,
        after: row.afterData,
        metadata: row.metadata,
        requestId: row.requestId
      })),
      total,
      page,
      pageSize
    );
  }
}
