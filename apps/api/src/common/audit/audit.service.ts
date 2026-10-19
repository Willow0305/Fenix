import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { RequestMeta } from '../http/request-context';
import { PrismaService, type PrismaTx } from '../prisma/prisma.service';

export interface AuditEntry {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly reason?: string | null;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly meta?: RequestMeta | null;
}

/** Campos que nunca podem chegar à auditoria, mesmo que um chamador os inclua. */
const FORBIDDEN_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'refreshToken',
  'refreshTokenHash',
  'pixKey',
  'pixKeyEncrypted',
  'bankingDetails',
  'bankingDetailsEncrypted',
  'documentNumber',
  'documentNumberEncrypted'
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value instanceof Prisma.Decimal) {
    return value.toFixed(2);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !FORBIDDEN_KEYS.has(key))
        .map(([key, nested]) => [key, sanitize(nested)])
    );
  }

  return value;
}

function toJson(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (sanitize(value) as Prisma.InputJsonValue);
}

/** Trilha de auditoria imutável (RF-024): somente inserção. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: PrismaTx): Promise<void> {
    const client = tx ?? this.prisma;

    await client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        reason: entry.reason ?? null,
        beforeData: toJson(entry.before),
        afterData: toJson(entry.after),
        metadata: toJson(entry.metadata),
        requestId: entry.meta?.requestId ?? null,
        ipAddressHash: entry.meta?.ipAddressHash ?? null,
        userAgent: entry.meta?.userAgent ?? null
      }
    });
  }
}
