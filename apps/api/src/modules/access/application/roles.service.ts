import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLES
} from '../domain/permission-catalog';

export interface RoleView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissions: readonly string[];
  readonly userCount: number;
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        rolePermissions: { select: { permission: { select: { code: true } } } },
        _count: { select: { userRoles: true } }
      }
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.rolePermissions.map((rp) => rp.permission.code).sort(),
      userCount: role._count.userRoles
    }));
  }

  permissions(): { code: string; name: string }[] {
    return ALL_PERMISSIONS.map((code) => ({ code, name: PERMISSION_LABELS[code] }));
  }

  /** O papel `admin` é fixo para impedir perda de governança. */
  async setPermissions(
    actor: Principal,
    roleCode: string,
    permissionCodes: readonly string[],
    reason: string,
    meta: RequestMeta
  ): Promise<RoleView> {
    if (roleCode === SYSTEM_ROLES.admin) {
      throw AppError.forbidden('As permissões do papel Administrador não podem ser alteradas.');
    }

    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: { code: roleCode, deletedAt: null },
        select: {
          id: true,
          rolePermissions: { select: { permission: { select: { code: true } } } }
        }
      });

      if (role === null) {
        throw AppError.notFound('Papel não encontrado.');
      }

      const unique = [...new Set(permissionCodes)];
      const permissions = await tx.permission.findMany({
        where: { code: { in: unique }, deletedAt: null },
        select: { id: true }
      });

      if (permissions.length !== unique.length) {
        throw AppError.validation('UNKNOWN_PERMISSION', 'Permissão inexistente informada.');
      }

      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: permissions.map((p) => p.id) } }
      });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
          grantedById: actor.userId
        })),
        skipDuplicates: true
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.permissions.changed',
          entityType: 'Role',
          entityId: role.id,
          reason,
          before: { permissions: role.rolePermissions.map((rp) => rp.permission.code).sort() },
          after: { permissions: unique.sort() },
          meta
        },
        tx
      );
    });

    const updated = (await this.list()).find((role) => role.code === roleCode);

    if (updated === undefined) {
      throw AppError.notFound('Papel não encontrado.');
    }

    return updated;
  }
}

/**
 * Sincroniza o catálogo de permissões e papéis de sistema. Na criação de um papel
 * aplica as permissões padrão; papéis existentes só recebem permissões novas do
 * catálogo (as removidas manualmente pela administração são respeitadas), exceto
 * `admin`, que sempre possui todas.
 */
export async function syncAccessCatalog(tx: PrismaTx): Promise<void> {
  const knownCodes = new Set(
    (await tx.permission.findMany({ select: { code: true } })).map((p) => p.code)
  );

  for (const code of ALL_PERMISSIONS) {
    await tx.permission.upsert({
      where: { code },
      create: { code, name: PERMISSION_LABELS[code], isSystem: true },
      update: { name: PERMISSION_LABELS[code], isSystem: true, deletedAt: null }
    });
  }

  const permissionIds = new Map(
    (await tx.permission.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );

  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    const existing = await tx.role.findUnique({
      where: { code: definition.code },
      select: { id: true }
    });
    const role = await tx.role.upsert({
      where: { code: definition.code },
      create: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        isSystem: true
      },
      update: {
        name: definition.name,
        description: definition.description,
        isSystem: true,
        deletedAt: null
      }
    });
    const toGrant =
      existing === null || definition.code === SYSTEM_ROLES.admin
        ? definition.permissions
        : definition.permissions.filter((code) => !knownCodes.has(code));

    await tx.rolePermission.createMany({
      data: toGrant.flatMap((code) => {
        const permissionId = permissionIds.get(code);

        return permissionId === undefined ? [] : [{ roleId: role.id, permissionId }];
      }),
      skipDuplicates: true
    });
  }
}
