import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { PrismaService } from '../../../common/prisma/prisma.service';

const AUDIT_INCLUDE = {
  actorUser: { select: { id: true, name: true } }
} satisfies Prisma.AuditLogInclude;

type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof AUDIT_INCLUDE }>;

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
  readonly requestId?: string;
}

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/** Datas civis são interpretadas no fuso do time; instantes ISO completos, como enviados. */
function lowerBound(value: string): Date {
  return CIVIL.test(value) ? startOfDayInZone(value) : new Date(value);
}

function upperBound(value: string): Date {
  return CIVIL.test(value) ? endOfDayExclusive(value) : new Date(value);
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
      ...(filters.requestId ? { requestId: filters.requestId } : {}),
      ...(filters.from || filters.to
        ? {
            occurredAt: {
              ...(filters.from ? { gte: lowerBound(filters.from) } : {}),
              ...(filters.to ? { lt: upperBound(filters.to) } : {})
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
        include: AUDIT_INCLUDE
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.view(row)),
      total,
      page,
      pageSize
    );
  }

  /** Detalhe de um registro (valores anterior/novo e metadados da requisição). */
  async get(id: string): Promise<AuditLogView & { related: AuditLogView[] }> {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: AUDIT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Registro de auditoria não encontrado.');
    }

    const related = row.requestId
      ? await this.prisma.auditLog.findMany({
          where: { requestId: row.requestId, id: { not: id } },
          include: AUDIT_INCLUDE,
          orderBy: { occurredAt: 'asc' },
          take: 50
        })
      : [];

    return { ...this.view(row), related: related.map((r) => this.view(r)) };
  }

  /** Tipos de entidade presentes, para o filtro da tela. */
  async entityTypes(): Promise<string[]> {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['entityType'],
      orderBy: { entityType: 'asc' }
    });

    return rows.map((row) => row.entityType);
  }

  private view(row: AuditRow): AuditLogView {
    return {
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
    };
  }
}
