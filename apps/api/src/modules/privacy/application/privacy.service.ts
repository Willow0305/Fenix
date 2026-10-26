import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type {
  PrivacyRequestStatus,
  PrivacyRequestType,
  Prisma
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { hashPassword } from '../../../common/crypto/password-hasher';
import { dateToCivil, optionalCivil } from '../../../common/domain/civil-date';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SYSTEM_ROLES } from '../../access/domain/permission-catalog';
import { NotificationsService } from '../../notifications/application/notifications.service';

export interface PrivacyRequestView {
  readonly id: string;
  readonly type: PrivacyRequestType;
  readonly status: PrivacyRequestStatus;
  readonly details: string | null;
  readonly resolution: string | null;
  readonly user?: { id: string; name: string; email: string };
  readonly handledBy: string | null;
  readonly handledAt: string | null;
  readonly createdAt: string;
}

/** Papéis que não podem ser anonimizados sem antes perder os acessos administrativos. */
const BASIC_ROLES: ReadonlySet<string> = new Set([SYSTEM_ROLES.user, SYSTEM_ROLES.athlete]);

export const ERASED_POST_TEXT = '[conteúdo removido a pedido do titular]';

const REQUEST_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  handledBy: { select: { name: true } }
} satisfies Prisma.PrivacyRequestInclude;

type RequestRow = Prisma.PrivacyRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

/**
 * Direitos do titular (LGPD art. 18; `13-SEGURANCA-E-LGPD.md`; DT-035). O titular exporta
 * os próprios dados a qualquer momento e pede eliminação; a diretoria com
 * `privacy.requests.manage` atende o pedido. A anonimização preserva registros com dever
 * legal de guarda (financeiro, pedidos, auditoria) e o cadastro esportivo até a definição
 * de retenção (`PEN-011`).
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  private view(row: RequestRow, admin: boolean): PrivacyRequestView {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      details: row.details,
      resolution: row.resolution,
      ...(admin ? { user: row.user } : {}),
      handledBy: row.handledBy?.name ?? null,
      handledAt: row.handledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString()
    };
  }

  /** Cópia legível dos dados pessoais do próprio titular (sem segredos nem dados de terceiros). */
  async exportOwn(principal: Principal, meta: RequestMeta): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        whatsappOptInAt: true,
        notificationPreferences: { select: { category: true, channel: true, enabled: true } },
        userRoles: { select: { role: { select: { name: true } } } },
        athlete: {
          select: {
            fullName: true,
            preferredName: true,
            birthDate: true,
            position: true,
            status: true,
            email: true,
            phone: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            guardianName: true,
            guardianPhone: true,
            teamMemberships: {
              select: { startsOn: true, endsOn: true, team: { select: { name: true } } }
            },
            monthlyFees: {
              select: { referenceMonth: true, dueDate: true, totalAmount: true, status: true },
              orderBy: { referenceMonth: 'desc' }
            }
          }
        },
        tryoutApplications: {
          select: { createdAt: true, status: true, tryout: { select: { title: true } } }
        },
        orders: {
          select: {
            orderNumber: true,
            createdAt: true,
            status: true,
            totalAmount: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            items: { select: { productName: true, quantity: true, totalAmount: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        appointments: {
          select: {
            createdAt: true,
            status: true,
            scheduledStartsAt: true,
            requesterNotes: true,
            partnerService: { select: { name: true } }
          }
        },
        favorites: { select: { createdAt: true, product: { select: { name: true } } } },
        forumPosts: {
          where: { status: { not: 'DELETED' } },
          select: { createdAt: true, content: true, topic: { select: { title: true } } }
        },
        notifications: {
          where: { deletedAt: null },
          select: { createdAt: true, title: true, message: true, readAt: true },
          orderBy: { createdAt: 'desc' },
          take: 500
        },
        sessions: {
          select: { createdAt: true, expiresAt: true, revokedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    await this.audit.record({
      actorUserId: principal.userId,
      action: 'privacy.data_exported',
      entityType: 'User',
      entityId: principal.userId,
      meta
    });

    const { athlete, ...account } = user;

    return {
      generatedAt: new Date().toISOString(),
      notice:
        'Cópia dos seus dados pessoais no sistema Fênix Vôlei. Senhas, tokens e dados de outras pessoas não são incluídos.',
      account: {
        ...account,
        roles: account.userRoles.map((r) => r.role.name),
        userRoles: undefined
      },
      athlete: athlete
        ? {
            ...athlete,
            birthDate: optionalCivil(athlete.birthDate),
            teamMemberships: athlete.teamMemberships.map((m) => ({
              team: m.team.name,
              startsOn: dateToCivil(m.startsOn),
              endsOn: optionalCivil(m.endsOn)
            })),
            monthlyFees: athlete.monthlyFees.map((fee) => ({
              referenceMonth: dateToCivil(fee.referenceMonth).slice(0, 7),
              dueDate: dateToCivil(fee.dueDate),
              totalAmount: fee.totalAmount.toFixed(2),
              status: fee.status
            }))
          }
        : null
    };
  }

  async mine(userId: string): Promise<PrivacyRequestView[]> {
    const rows = await this.prisma.privacyRequest.findMany({
      where: { userId },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((row) => this.view(row, false));
  }

  /** Um pedido aberto por tipo; repetir devolve o pedido existente. */
  async request(
    principal: Principal,
    input: { type: PrivacyRequestType; details?: string },
    meta: RequestMeta
  ): Promise<PrivacyRequestView> {
    const existing = await this.prisma.privacyRequest.findFirst({
      where: {
        userId: principal.userId,
        type: input.type,
        status: { in: ['OPEN', 'IN_PROGRESS'] }
      },
      include: REQUEST_INCLUDE
    });

    if (existing) {
      return this.view(existing, false);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.privacyRequest.create({
        data: {
          userId: principal.userId,
          type: input.type,
          details: input.details?.trim() || null
        },
        include: REQUEST_INCLUDE
      });

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'privacy.request.created',
          entityType: 'PrivacyRequest',
          entityId: created.id,
          after: { type: input.type },
          meta
        },
        tx
      );

      const handlers = await this.notifications.permissionHolders('privacy.requests.manage', tx);

      await this.notifications.notify(
        handlers.map((userId) => ({
          userId,
          type: 'privacy.request',
          title: 'Nova solicitação de titular (LGPD)',
          message: 'Há uma solicitação de titular aguardando atendimento.',
          link: '/admin/privacidade',
          deduplicationKey: `privacy-request:${created.id}:${userId}`
        })),
        tx
      );

      return created;
    });

    return this.view(row, false);
  }

  async list(
    query: PageQueryDto & { status?: PrivacyRequestStatus }
  ): Promise<Page<PrivacyRequestView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.PrivacyRequestWhereInput = query.status ? { status: query.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.privacyRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip,
        take
      }),
      this.prisma.privacyRequest.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.view(row, true)),
      total,
      page,
      pageSize
    );
  }

  /** Andamento ou recusa (com justificativa); conclusão de eliminação é feita por `anonymize`. */
  async update(
    actor: Principal,
    id: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED',
    resolution: string | undefined,
    meta: RequestMeta
  ): Promise<PrivacyRequestView> {
    const current = await this.prisma.privacyRequest.findUnique({ where: { id } });

    if (current === null) {
      throw AppError.notFound('Solicitação não encontrada.');
    }

    if (current.status === 'COMPLETED' || current.status === 'REJECTED') {
      throw AppError.conflict('REQUEST_CLOSED', 'Esta solicitação já foi concluída.');
    }

    if (status !== 'IN_PROGRESS' && !resolution) {
      throw AppError.validation('RESOLUTION_REQUIRED', 'Descreva a resposta dada ao titular.');
    }

    if (status === 'COMPLETED' && current.type === 'ERASURE') {
      throw AppError.validation(
        'USE_ANONYMIZE',
        'Para concluir um pedido de eliminação, execute a anonimização da conta.'
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.privacyRequest.update({
        where: { id },
        data: {
          status,
          resolution: resolution ?? null,
          handledById: actor.userId,
          handledAt: new Date()
        },
        include: REQUEST_INCLUDE
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'privacy.request.updated',
          entityType: 'PrivacyRequest',
          entityId: id,
          reason: resolution ?? null,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );

      if (status !== 'IN_PROGRESS') {
        await this.notifications.notify(
          {
            userId: current.userId,
            type: 'privacy.request.answered',
            title: 'Sua solicitação de privacidade foi respondida',
            message: resolution ?? '',
            link: '/minha-conta/privacidade',
            deduplicationKey: `privacy-answered:${id}`
          },
          tx
        );
      }

      return updated;
    });

    return this.view(row, true);
  }

  /**
   * Eliminação a pedido do titular: anonimiza a conta e o conteúdo publicado, encerra
   * sessões e remove preferências. Mantém pedidos, pagamentos e auditoria (dever legal)
   * e o cadastro esportivo, que fica desvinculado da conta até a política de retenção.
   */
  async anonymize(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<PrivacyRequestView> {
    const request = await this.prisma.privacyRequest.findUnique({
      where: { id },
      include: { user: { include: { userRoles: { include: { role: true } } } } }
    });

    if (request === null) {
      throw AppError.notFound('Solicitação não encontrada.');
    }

    if (
      request.type !== 'ERASURE' ||
      request.status === 'COMPLETED' ||
      request.status === 'REJECTED'
    ) {
      throw AppError.conflict('NOT_ERASABLE', 'Esta solicitação não permite anonimização.');
    }

    if (request.userId === actor.userId) {
      throw AppError.conflict(
        'SELF_ERASURE',
        'Outra pessoa da diretoria deve atender este pedido.'
      );
    }

    if (request.user.userRoles.some((userRole) => !BASIC_ROLES.has(userRole.role.code))) {
      throw AppError.conflict(
        'PRIVILEGED_ACCOUNT',
        'Remova os papéis administrativos da conta antes de anonimizá-la.'
      );
    }

    const userId = request.userId;
    const now = new Date();
    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Titular anonimizado',
          email: `anonimizado+${userId}@invalid.local`,
          phone: null,
          whatsappOptInAt: null,
          passwordHash,
          status: 'INACTIVE',
          emailVerifiedAt: null,
          deletedAt: now
        }
      });
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revocationReason: 'Anonimização a pedido do titular' }
      });
      await tx.userToken.deleteMany({ where: { userId } });
      await tx.favorite.deleteMany({ where: { userId } });
      await tx.forumReaction.deleteMany({ where: { userId } });
      await tx.forumPost.updateMany({
        where: { authorUserId: userId },
        data: { content: ERASED_POST_TEXT, status: 'DELETED', deletedAt: now }
      });
      await tx.appointment.updateMany({
        where: { requesterUserId: userId },
        data: { requesterNotes: null }
      });
      await tx.notification.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now }
      });
      // Nada mais sai por e-mail ou WhatsApp para a conta anonimizada (DT-048).
      await tx.notificationDelivery.updateMany({
        where: { status: { in: ['PENDING', 'SENDING'] }, notification: { userId } },
        data: { status: 'CANCELLED', failureCode: 'CONTA_ANONIMIZADA', lockedUntil: null }
      });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.athlete.updateMany({ where: { userId }, data: { userId: null } });
      await tx.userRole.deleteMany({ where: { userId } });

      const updated = await tx.privacyRequest.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          resolution: reason,
          handledById: actor.userId,
          handledAt: now
        },
        include: REQUEST_INCLUDE
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'privacy.account.anonymized',
          entityType: 'User',
          entityId: userId,
          reason,
          after: {
            requestId: id,
            retained: [
              'pedidos',
              'pagamentos e Caixa',
              'auditoria',
              'cadastro esportivo desvinculado'
            ]
          },
          meta
        },
        tx
      );

      return updated;
    });

    return this.view(row, true);
  }
}
