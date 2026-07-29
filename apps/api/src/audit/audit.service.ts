import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { hashRequestValue } from '../common/security/security';
import { PrismaService } from '../database/prisma.service';
import type { AuditAction } from './audit-actions';

const FORBIDDEN_AUDIT_KEY_FRAGMENTS = [
  'authorization',
  'cookie',
  'mfa',
  'otp',
  'qr',
  'recovery',
  'password',
  'secret',
  'token'
] as const;

type AuditDatabaseClient = Pick<Prisma.TransactionClient, 'auditLog'>;

interface AuditRecordInput {
  readonly action: AuditAction;
  readonly actorUserId?: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly reason?: string;
  readonly beforeData?: Prisma.InputJsonValue;
  readonly afterData?: Prisma.InputJsonValue;
  readonly metadata?: Prisma.InputJsonValue;
  readonly request?: RequestWithPrincipal;
}

interface AuditListInput {
  readonly action?: string;
  readonly actorUserId?: string;
  readonly cursor?: string;
  readonly entityType?: string;
  readonly limit: number;
}

function sanitizeJson(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJson(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => {
          const normalizedKey = key.toLocaleLowerCase('en-US');

          return (
            normalizedKey !== 'code' &&
            normalizedKey !== 'recoverycode' &&
            !FORBIDDEN_AUDIT_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment))
          );
        })
        .map(([key, item]) => [key, sanitizeJson(item)])
    );
  }

  return value;
}

@Injectable()
export class AuditService {
  private readonly contextPepper: string;

  public constructor(private readonly prisma: PrismaService) {
    const configuredPepper = process.env['AUTH_CONTEXT_HASH_PEPPER'];

    if (
      process.env['NODE_ENV'] === 'production' &&
      (!configuredPepper || configuredPepper.length < 32)
    ) {
      throw new Error('AUTH_CONTEXT_HASH_PEPPER deve possuir ao menos 32 caracteres em produção.');
    }

    this.contextPepper = configuredPepper ?? 'fenix-local-context-hash-pepper';
  }

  public async record(
    input: AuditRecordInput,
    database: AuditDatabaseClient = this.prisma
  ): Promise<void> {
    const userAgent = input.request?.header('user-agent');
    const ipAddress = input.request?.ip;
    const ipAddressHash = hashRequestValue(ipAddress, this.contextPepper);
    const userAgentHash = hashRequestValue(userAgent, this.contextPepper);
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: input.action,
      entityType: input.entityType,
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.beforeData !== undefined ? { beforeData: sanitizeJson(input.beforeData) } : {}),
      ...(input.afterData !== undefined ? { afterData: sanitizeJson(input.afterData) } : {}),
      ...(input.metadata !== undefined ? { metadata: sanitizeJson(input.metadata) } : {}),
      ...(input.request?.requestId ? { requestId: input.request.requestId } : {}),
      ...(ipAddressHash ? { ipAddressHash } : {}),
      ...(userAgentHash ? { userAgentHash } : {})
    };

    await database.auditLog.create({
      data
    });
  }

  public async list(input: AuditListInput) {
    const records = await this.prisma.auditLog.findMany({
      where: {
        ...(input.action ? { action: input.action } : {}),
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        ...(input.entityType ? { entityType: input.entityType } : {})
      },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor
        ? {
            cursor: {
              id: input.cursor
            },
            skip: 1
          }
        : {})
    });
    const hasNextPage = records.length > input.limit;
    const pageRecords = hasNextPage ? records.slice(0, input.limit) : records;

    return {
      data: pageRecords.map((record) => ({
        id: record.id,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        reason: record.reason,
        beforeData: record.beforeData,
        afterData: record.afterData,
        metadata: record.metadata,
        requestId: record.requestId,
        occurredAt: record.occurredAt.toISOString(),
        actor: record.actorUser
      })),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? pageRecords.at(-1)?.id : undefined
      }
    };
  }
}
