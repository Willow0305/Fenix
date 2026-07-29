import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSubjectRequestStatus, type DataSubjectRequestType } from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { hashSecret, normalizeEmail } from '../common/security/security';
import { PrismaService } from '../database/prisma.service';
import { AuthConfig } from '../auth/auth.config';
import { RetentionConfig } from './retention.config';

const TERMINAL_REQUEST_STATUSES = new Set<DataSubjectRequestStatus>([
  DataSubjectRequestStatus.COMPLETED,
  DataSubjectRequestStatus.REJECTED,
  DataSubjectRequestStatus.CANCELLED
]);

@Injectable()
export class PrivacyService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly retention: RetentionConfig,
    private readonly authConfig: AuthConfig
  ) {}

  public async listRequests() {
    const requests = await this.prisma.dataSubjectRequest.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: 100
    });

    return {
      data: requests.map((item) => ({
        id: item.id,
        protocol: item.protocol,
        requesterEmail: item.requesterEmail,
        subjectUserId: item.subjectUserId,
        type: item.type,
        status: item.status,
        channel: item.channel,
        description: item.description,
        decisionReason: item.decisionReason,
        receivedAt: item.receivedAt.toISOString(),
        dueAt: item.dueAt?.toISOString(),
        completedAt: item.completedAt?.toISOString()
      }))
    };
  }

  public async createRequest(
    input: {
      readonly subjectUserId?: string;
      readonly requesterEmail: string;
      readonly type: DataSubjectRequestType;
      readonly channel: string;
      readonly description?: string;
    },
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const protocol = `FENIX-${new Date().getUTCFullYear()}-${randomUUID()
      .replace(/-/gu, '')
      .slice(0, 12)
      .toUpperCase()}`;
    const record = await this.prisma.$transaction(async (database) => {
      const created = await database.dataSubjectRequest.create({
        data: {
          protocol,
          requesterEmail: normalizeEmail(input.requesterEmail),
          type: input.type,
          channel: input.channel.trim(),
          ...(input.subjectUserId ? { subjectUserId: input.subjectUserId } : {}),
          ...(input.description ? { description: input.description.trim() } : {})
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.privacyRequestCreated,
          actorUserId,
          entityType: 'DataSubjectRequest',
          entityId: created.id,
          afterData: {
            protocol,
            status: created.status,
            type: created.type
          },
          request
        },
        database
      );

      return created;
    });

    return {
      id: record.id,
      protocol: record.protocol,
      status: record.status
    };
  }

  public async updateRequest(
    id: string,
    status: DataSubjectRequestStatus,
    decisionReason: string | undefined,
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const current = await this.prisma.dataSubjectRequest.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException({
        code: 'PRIVACY_REQUEST_NOT_FOUND',
        message: 'Solicitação de privacidade não encontrada.'
      });
    }

    const completedAt = TERMINAL_REQUEST_STATUSES.has(status) ? new Date() : null;

    await this.prisma.$transaction(async (database) => {
      await database.dataSubjectRequest.update({
        where: { id },
        data: {
          status,
          completedAt,
          handledById: actorUserId,
          ...(decisionReason ? { decisionReason: decisionReason.trim() } : {})
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.privacyRequestUpdated,
          actorUserId,
          entityType: 'DataSubjectRequest',
          entityId: id,
          beforeData: { status: current.status },
          afterData: { status },
          request
        },
        database
      );
    });
  }

  public async runRetention(dryRun: boolean, actorUserId: string, request: RequestWithPrincipal) {
    const now = new Date();
    const sessionCutoff = new Date(
      now.getTime() - this.retention.revokedSessionDays * 24 * 60 * 60_000
    );
    const accountCutoff = new Date(
      now.getTime() - this.retention.closedAccountDays * 24 * 60 * 60_000
    );
    const run = await this.prisma.retentionRun.create({
      data: {
        dryRun,
        policyVersion: this.retention.policyVersion,
        initiatedById: actorUserId
      }
    });

    try {
      const candidates = {
        expiredTokens: await this.prisma.userToken.count({
          where: {
            OR: [{ expiresAt: { lt: now } }, { consumedAt: { lt: now } }]
          }
        }),
        revokedSessions: await this.prisma.userSession.count({
          where: {
            revokedAt: { lt: sessionCutoff }
          }
        }),
        closedAccounts: await this.prisma.user.count({
          where: {
            deletedAt: { lt: accountCutoff }
          }
        })
      };
      let applied = {
        expiredTokens: 0,
        revokedSessions: 0,
        closedAccounts: 0
      };

      if (!dryRun) {
        applied = await this.prisma.$transaction(
          async (database) => {
            const tokens = await database.userToken.deleteMany({
              where: {
                OR: [{ expiresAt: { lt: now } }, { consumedAt: { lt: now } }]
              }
            });
            const sessions = await database.userSession.deleteMany({
              where: {
                revokedAt: { lt: sessionCutoff }
              }
            });
            const users = await database.user.findMany({
              where: {
                deletedAt: { lt: accountCutoff }
              },
              select: { id: true }
            });

            for (const user of users) {
              await database.user.update({
                where: { id: user.id },
                data: {
                  name: 'Titular anonimizado',
                  email: `anon-${user.id}@invalid.fenix.local`,
                  passwordHash: hashSecret(
                    user.id,
                    this.authConfig.tokenPepper,
                    'retention-account'
                  ),
                  status: 'INACTIVE',
                  emailVerifiedAt: null,
                  failedLoginAttempts: 0,
                  loginFailureWindowStartedAt: null,
                  blockedUntil: null
                }
              });
            }

            return {
              expiredTokens: tokens.count,
              revokedSessions: sessions.count,
              closedAccounts: users.length
            };
          },
          {
            isolationLevel: 'Serializable'
          }
        );
      }

      const summary = {
        candidates,
        applied
      };

      await this.prisma.$transaction(async (database) => {
        await database.retentionRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            summary
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.retentionRunCompleted,
            actorUserId,
            entityType: 'RetentionRun',
            entityId: run.id,
            metadata: {
              dryRun,
              policyVersion: this.retention.policyVersion
            },
            request
          },
          database
        );
      });

      return {
        id: run.id,
        dryRun,
        policyVersion: this.retention.policyVersion,
        ...summary
      };
    } catch (error) {
      await this.prisma.retentionRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorCode: 'RETENTION_EXECUTION_FAILED'
        }
      });
      throw error;
    }
  }
}
