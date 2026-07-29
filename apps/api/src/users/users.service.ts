import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, UserStatus } from '@prisma/client';

import { ROLE_CODES } from '../access-control/access.constants';
import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { EmailVerificationService } from '../auth/email-verification.service';
import { MfaService } from '../auth/mfa.service';
import { PasswordHasherService } from '../auth/password-hasher.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { normalizeEmail } from '../common/security/security';
import { PrismaService } from '../database/prisma.service';

interface ListUsersInput {
  readonly cursor?: string;
  readonly limit: number;
  readonly status?: UserStatus;
}

@Injectable()
export class UsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly emailVerification: EmailVerificationService,
    private readonly mfa: MfaService
  ) {}

  public async list(input: ListUsersInput) {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(input.status ? { status: input.status } : {})
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        },
        mfaCredential: {
          select: {
            confirmedAt: true
          }
        }
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1
          }
        : {})
    });
    const hasNextPage = users.length > input.limit;
    const pageUsers = hasNextPage ? users.slice(0, input.limit) : users;

    return {
      data: pageUsers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
        mfaEnabled: user.mfaCredential?.confirmedAt !== null && user.mfaCredential !== null,
        lastLoginAt: user.lastLoginAt?.toISOString(),
        temporarilyBlockedUntil: user.blockedUntil?.toISOString(),
        roles: user.userRoles
          .filter(({ role }) => !role.deletedAt)
          .map(({ role }) => role.code)
          .sort(),
        createdAt: user.createdAt.toISOString()
      })),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? pageUsers.at(-1)?.id : undefined
      }
    };
  }

  public async create(
    input: { readonly name: string; readonly email: string; readonly password: string },
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Não foi possível criar a conta com os dados informados.'
      });
    }

    const commonRole = await this.prisma.role.findUnique({
      where: { code: ROLE_CODES.user }
    });

    if (!commonRole || commonRole.deletedAt) {
      throw new ConflictException({
        code: 'ACCESS_CATALOG_NOT_INITIALIZED',
        message: 'O catálogo de acesso precisa ser inicializado pelo comando administrativo.'
      });
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.prisma.$transaction(async (database) => {
      const createdUser = await database.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          status: UserStatus.PENDING
        }
      });
      await database.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: commonRole.id,
          grantedById: actorUserId
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.userCreated,
          actorUserId,
          entityType: 'User',
          entityId: createdUser.id,
          afterData: {
            name: createdUser.name,
            status: createdUser.status,
            roles: [ROLE_CODES.user]
          },
          request
        },
        database
      );

      return createdUser;
    });

    await this.emailVerification.request(user.email, request);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      emailVerifiedAt: undefined,
      mfaEnabled: false,
      roles: [ROLE_CODES.user]
    };
  }

  public async updateName(
    userId: string,
    nameInput: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const user = await this.findUser(userId);
    const name = nameInput.trim();

    await this.prisma.$transaction(async (database) => {
      await database.user.update({
        where: { id: userId },
        data: { name }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.userUpdated,
          actorUserId,
          entityType: 'User',
          entityId: userId,
          beforeData: { name: user.name },
          afterData: { name },
          request
        },
        database
      );
    });
  }

  public async updateStatus(
    userId: string,
    status: UserStatus,
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (database) => {
      await this.acquireAdministratorInvariantLock(database);
      const user = await database.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!user || user.deletedAt) {
        throw this.userNotFound();
      }

      if (status === UserStatus.ACTIVE && !user.emailVerifiedAt) {
        throw new ConflictException({
          code: 'EMAIL_VERIFICATION_REQUIRED',
          message: 'O e-mail deve ser verificado antes de ativar a conta.'
        });
      }

      const isAdministrator = user.userRoles.some(
        ({ role }) => role.code === ROLE_CODES.administrator && !role.deletedAt
      );

      if (
        isAdministrator &&
        user.status === UserStatus.ACTIVE &&
        status !== UserStatus.ACTIVE &&
        (await this.countActiveAdministrators(database, userId)) === 0
      ) {
        throw new ConflictException({
          code: 'LAST_ADMINISTRATOR_REQUIRED',
          message: 'O último administrador ativo não pode ser bloqueado ou inativado.'
        });
      }

      const action =
        status === UserStatus.BLOCKED
          ? AUDIT_ACTIONS.userBlocked
          : user.status === UserStatus.BLOCKED && status === UserStatus.ACTIVE
            ? AUDIT_ACTIONS.userUnblocked
            : AUDIT_ACTIONS.userUpdated;

      await database.user.update({
        where: { id: userId },
        data: {
          status,
          ...(status === UserStatus.ACTIVE
            ? {
                blockedUntil: null,
                failedLoginAttempts: 0,
                loginFailureWindowStartedAt: null
              }
            : {})
        }
      });

      if (status !== UserStatus.ACTIVE) {
        await database.userSession.updateMany({
          where: {
            userId,
            revokedAt: null
          },
          data: {
            revokedAt: now,
            revocationReason: 'ACCOUNT_STATUS_CHANGED'
          }
        });
      }

      await this.audit.record(
        {
          action,
          actorUserId,
          entityType: 'User',
          entityId: userId,
          beforeData: { status: user.status },
          afterData: { status },
          request
        },
        database
      );
    });
  }

  public async replaceRoles(
    userId: string,
    roleCodesInput: readonly string[],
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const roleCodes = [...new Set(roleCodesInput)];

    await this.prisma.$transaction(async (database) => {
      await this.acquireAdministratorInvariantLock(database);
      const user = await database.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });

      if (!user || user.deletedAt) {
        throw this.userNotFound();
      }

      const roles = await database.role.findMany({
        where: {
          code: { in: roleCodes },
          deletedAt: null
        }
      });

      if (roles.length !== roleCodes.length) {
        throw new NotFoundException({
          code: 'ROLE_NOT_FOUND',
          message: 'Um ou mais papéis não pertencem ao catálogo vigente.'
        });
      }

      const beforeRoles = user.userRoles
        .filter(({ role }) => !role.deletedAt)
        .map(({ role }) => role.code)
        .sort();
      const removesAdministrator =
        beforeRoles.includes(ROLE_CODES.administrator) &&
        !roleCodes.includes(ROLE_CODES.administrator);

      if (
        removesAdministrator &&
        user.status === UserStatus.ACTIVE &&
        (await this.countActiveAdministrators(database, userId)) === 0
      ) {
        throw new ConflictException({
          code: 'LAST_ADMINISTRATOR_REQUIRED',
          message: 'O papel do último administrador ativo não pode ser removido.'
        });
      }

      await database.userRole.deleteMany({ where: { userId } });

      if (roles.length > 0) {
        await database.userRole.createMany({
          data: roles.map((role) => ({
            userId,
            roleId: role.id,
            grantedById: actorUserId
          }))
        });
      }

      await this.audit.record(
        {
          action: AUDIT_ACTIONS.userRolesChanged,
          actorUserId,
          entityType: 'User',
          entityId: userId,
          beforeData: { roles: beforeRoles },
          afterData: { roles: [...roleCodes].sort() },
          request
        },
        database
      );
    });
  }

  public async revokeSessions(
    userId: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    await this.findUser(userId);
    const now = new Date();

    await this.prisma.$transaction(async (database) => {
      await database.userSession.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revocationReason: 'ADMINISTRATIVE_REVOCATION'
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.userUpdated,
          actorUserId,
          entityType: 'UserSession',
          entityId: userId,
          reason: 'SESSIONS_REVOKED',
          request
        },
        database
      );
    });
  }

  public async resetMfa(
    userId: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    await this.findUser(userId);
    await this.mfa.resetByAdministrator(userId, actorUserId, request);
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt) {
      throw this.userNotFound();
    }

    return user;
  }

  private async acquireAdministratorInvariantLock(
    database: Prisma.TransactionClient
  ): Promise<void> {
    await database.$queryRaw<Array<{ readonly locked: boolean }>>`
      SELECT TRUE AS "locked"
      FROM pg_advisory_xact_lock(117894584, 1)
    `;
  }

  private countActiveAdministrators(
    database: Prisma.TransactionClient,
    excludeUserId: string
  ): Promise<number> {
    return database.user.count({
      where: {
        id: { not: excludeUserId },
        status: UserStatus.ACTIVE,
        deletedAt: null,
        userRoles: {
          some: {
            role: {
              code: ROLE_CODES.administrator,
              deletedAt: null
            },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        }
      }
    });
  }

  private userNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'USER_NOT_FOUND',
      message: 'Usuário não encontrado.'
    });
  }
}
