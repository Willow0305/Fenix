import { Injectable } from '@nestjs/common';
import type { Prisma, UserStatus } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { generateOpaqueToken } from '../../../common/crypto/tokens';
import { hashPassword } from '../../../common/crypto/password-hasher';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { AuthService } from '../../auth/application/auth.service';
import { normalizeEmail, REVOCATION } from '../../auth/domain/auth-rules';
import { SYSTEM_ROLES } from '../domain/permission-catalog';

export interface AdminUserView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly status: UserStatus;
  readonly roles: readonly string[];
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly mfaEnabled: boolean;
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  mfaEnabledAt: true,
  userRoles: { select: { role: { select: { code: true } } } }
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function toView(user: UserRow): AdminUserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    roles: user.userRoles.map((userRole) => userRole.role.code).sort(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    mfaEnabled: user.mfaEnabledAt !== null
  };
}

@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService
  ) {}

  async list(
    query: PageQueryDto & { status?: UserStatus; role?: string }
  ): Promise<Page<AdminUserView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.role === undefined ? {} : { userRoles: { some: { role: { code: query.role } } } }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take
      }),
      this.prisma.user.count({ where })
    ]);

    return toPage(rows.map(toView), total, page, pageSize);
  }

  async get(id: string): Promise<AdminUserView> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT
    });

    if (user === null) {
      throw AppError.notFound('Usuário não encontrado.');
    }

    return toView(user);
  }

  /**
   * Cria conta pela administração. A senha inicial é aleatória e descartada: o usuário
   * define a própria senha pelo link de redefinição enviado ao e-mail.
   */
  async create(
    actor: Principal,
    input: { name: string; email: string; phone?: string; roles: readonly string[] },
    meta: RequestMeta
  ): Promise<AdminUserView> {
    const email = normalizeEmail(input.email);
    const roleCodes = input.roles.length > 0 ? input.roles : [SYSTEM_ROLES.user];
    const passwordHash = await hashPassword(generateOpaqueToken(24));

    const created = await this.prisma.$transaction(async (tx) => {
      const roles = await this.resolveRoles(tx, roleCodes);
      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          phone: input.phone?.trim() || null,
          passwordHash,
          status: 'ACTIVE',
          userRoles: {
            create: roles.map((role) => ({ roleId: role.id, grantedById: actor.userId }))
          }
        },
        select: USER_SELECT
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'user.created_by_admin',
          entityType: 'User',
          entityId: user.id,
          after: { email, roles: roleCodes },
          meta
        },
        tx
      );

      return user;
    });

    await this.auth.requestPasswordReset(email, meta);

    return toView(created);
  }

  private async resolveRoles(
    tx: PrismaTx,
    codes: readonly string[]
  ): Promise<{ id: string; code: string }[]> {
    const unique = [...new Set(codes)];
    const roles = await tx.role.findMany({
      where: { code: { in: unique }, deletedAt: null },
      select: { id: true, code: true }
    });

    if (roles.length !== unique.length) {
      throw AppError.validation('UNKNOWN_ROLE', 'Papel inexistente informado.');
    }

    return roles;
  }

  private async countActiveAdmins(tx: PrismaTx, excludingUserId: string): Promise<number> {
    return tx.user.count({
      where: {
        id: { not: excludingUserId },
        status: 'ACTIVE',
        deletedAt: null,
        userRoles: { some: { role: { code: SYSTEM_ROLES.admin } } }
      }
    });
  }

  /** Substitui o conjunto de papéis. Impede autoelevação/remoção e ficar sem administrador. */
  async setRoles(
    actor: Principal,
    userId: string,
    roleCodes: readonly string[],
    reason: string,
    meta: RequestMeta
  ): Promise<AdminUserView> {
    if (userId === actor.userId) {
      throw AppError.forbidden('Você não pode alterar os próprios papéis.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: USER_SELECT
      });

      if (current === null) {
        throw AppError.notFound('Usuário não encontrado.');
      }

      const roles = await this.resolveRoles(tx, roleCodes);
      const before = current.userRoles.map((userRole) => userRole.role.code).sort();
      const removingAdmin =
        before.includes(SYSTEM_ROLES.admin) && !roleCodes.includes(SYSTEM_ROLES.admin);

      if (removingAdmin && (await this.countActiveAdmins(tx, userId)) === 0) {
        throw AppError.conflict(
          'LAST_ADMIN',
          'O sistema precisa manter ao menos um administrador ativo.'
        );
      }

      await tx.userRole.deleteMany({
        where: { userId, roleId: { notIn: roles.map((role) => role.id) } }
      });

      for (const role of roles) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: role.id } },
          create: { userId, roleId: role.id, grantedById: actor.userId },
          update: {}
        });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'user.roles.changed',
          entityType: 'User',
          entityId: userId,
          reason,
          before: { roles: before },
          after: { roles: [...new Set(roleCodes)].sort() },
          meta
        },
        tx
      );

      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
    });

    return toView(updated);
  }

  async setStatus(
    actor: Principal,
    userId: string,
    status: UserStatus,
    reason: string,
    meta: RequestMeta
  ): Promise<AdminUserView> {
    if (userId === actor.userId) {
      throw AppError.forbidden('Você não pode alterar o status da própria conta.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: USER_SELECT
      });

      if (current === null) {
        throw AppError.notFound('Usuário não encontrado.');
      }

      const isAdmin = current.userRoles.some(
        (userRole) => userRole.role.code === SYSTEM_ROLES.admin
      );

      if (status !== 'ACTIVE' && isAdmin && (await this.countActiveAdmins(tx, userId)) === 0) {
        throw AppError.conflict(
          'LAST_ADMIN',
          'O sistema precisa manter ao menos um administrador ativo.'
        );
      }

      await tx.user.update({ where: { id: userId }, data: { status } });

      if (status !== 'ACTIVE') {
        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: REVOCATION.accountDisabled }
        });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'user.status.changed',
          entityType: 'User',
          entityId: userId,
          reason,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );

      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
    });

    return toView(updated);
  }

  async revokeSessions(
    actor: Principal,
    userId: string,
    reason: string,
    meta: RequestMeta
  ): Promise<number> {
    await this.get(userId);
    const count = await this.auth.revokeAllSessions(userId, REVOCATION.revokedByAdmin);

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'user.sessions.revoked',
      entityType: 'User',
      entityId: userId,
      reason,
      metadata: { count },
      meta
    });

    return count;
  }
}
