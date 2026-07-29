import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { PrismaService } from '../database/prisma.service';
import {
  CURRENT_PERMISSIONS,
  CURRENT_ROLES,
  PERMISSION_CODES,
  ROLE_CODES
} from './access.constants';

type AccessDatabaseClient = Pick<
  Prisma.TransactionClient,
  'permission' | 'role' | 'rolePermission'
>;

@Injectable()
export class AccessControlService implements OnApplicationBootstrap {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    await this.ensureCurrentCatalog();
  }

  public async ensureCurrentCatalog(database: AccessDatabaseClient = this.prisma): Promise<void> {
    for (const permission of CURRENT_PERMISSIONS) {
      await database.permission.upsert({
        where: { code: permission.code },
        create: {
          ...permission,
          isSystem: true
        },
        update: {
          name: permission.name,
          description: permission.description,
          isSystem: true,
          deletedAt: null
        }
      });
    }

    for (const roleDefinition of CURRENT_ROLES) {
      const role = await database.role.upsert({
        where: { code: roleDefinition.code },
        create: {
          code: roleDefinition.code,
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true
        },
        update: {
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true,
          deletedAt: null
        }
      });

      for (const permissionCode of roleDefinition.permissions) {
        const permission = await database.permission.findUniqueOrThrow({
          where: { code: permissionCode }
        });

        await database.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          create: {
            roleId: role.id,
            permissionId: permission.id
          },
          update: {}
        });
      }
    }
  }

  public async ensurePhaseOneCatalog(database: AccessDatabaseClient = this.prisma): Promise<void> {
    await this.ensureCurrentCatalog(database);
  }

  public async listRoles() {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      include: {
        rolePermissions: {
          include: {
            permission: true
          },
          orderBy: {
            permission: {
              code: 'asc'
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return {
      data: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: role.rolePermissions
          .filter(({ permission }) => !permission.deletedAt)
          .map(({ permission }) => permission.code)
      }))
    };
  }

  public async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: {
        code: 'asc'
      }
    });

    return {
      data: permissions.map((permission) => ({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        description: permission.description,
        isSystem: permission.isSystem
      }))
    };
  }

  public async replaceRolePermissions(
    roleId: string,
    permissionCodes: readonly string[],
    actorUserId: string,
    request: RequestWithPrincipal
  ): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Papel não encontrado.'
      });
    }

    if (role.code === ROLE_CODES.administrator) {
      throw new ConflictException({
        code: 'PROTECTED_ADMIN_ROLE',
        message: 'As permissões do papel Administrador são protegidas nesta fase.'
      });
    }

    const uniqueCodes = [...new Set(permissionCodes)];
    const permissions = await this.prisma.permission.findMany({
      where: {
        code: { in: uniqueCodes },
        deletedAt: null
      }
    });

    if (permissions.length !== uniqueCodes.length) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: 'Uma ou mais permissões não pertencem ao catálogo vigente.'
      });
    }

    const beforeCodes = role.rolePermissions
      .filter(({ permission }) => !permission.deletedAt)
      .map(({ permission }) => permission.code)
      .sort();

    await this.prisma.$transaction(async (database) => {
      await database.rolePermission.deleteMany({
        where: { roleId }
      });

      if (permissions.length > 0) {
        await database.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
            grantedById: actorUserId
          }))
        });
      }

      await this.audit.record(
        {
          action: AUDIT_ACTIONS.permissionsChanged,
          actorUserId,
          entityType: 'Role',
          entityId: roleId,
          beforeData: {
            permissions: beforeCodes
          },
          afterData: {
            permissions: [...uniqueCodes].sort()
          },
          request
        },
        database
      );
    });
  }

  public isKnownPhaseOnePermission(code: string): boolean {
    return Object.values(PERMISSION_CODES).some((permission) => permission === code);
  }
}
