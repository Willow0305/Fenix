import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  ALL_PERMISSIONS,
  PERMISSION_AREAS,
  PERMISSION_LABELS,
  permissionArea,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLES
} from '../domain/permission-catalog';

export interface RoleInput {
  readonly name: string;
  readonly description?: string | null;
  readonly permissions?: readonly string[];
  /** Começa com as permissões de outro papel (ex.: copiar "Diretoria" e tirar o que não precisa). */
  readonly copyFrom?: string;
}

/** "Atendimento & Loja" → "atendimento-loja": código estável do papel criado pelo painel. */
function roleCode(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'papel'
  );
}

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

  /** Catálogo na ordem das áreas da tela (estável dentro de cada área). */
  permissions(): { code: string; name: string; area: string }[] {
    const order = PERMISSION_AREAS.map((area) => area.name);

    return ALL_PERMISSIONS.map((code) => ({
      code,
      name: PERMISSION_LABELS[code],
      area: permissionArea(code)
    })).sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));
  }

  private async view(code: string): Promise<RoleView> {
    const role = (await this.list()).find((item) => item.code === code);

    if (role === undefined) {
      throw AppError.notFound('Papel não encontrado.');
    }

    return role;
  }

  /** Papéis de sistema são fixos: nome, descrição e existência vêm do catálogo. */
  private assertCustom(role: { isSystem: boolean } | null): asserts role is { isSystem: false } {
    if (role === null) {
      throw AppError.notFound('Papel não encontrado.');
    }

    if (role.isSystem) {
      throw AppError.forbidden(
        'Papéis do sistema (Administrador, Diretoria, Atleta, Usuário) não são renomeados nem excluídos.'
      );
    }
  }

  /**
   * Papel criado pela administração (DT-078) para um trabalho: financeiro, atendimento,
   * cadastro etc. Permissões escolhidas ou copiadas de outro papel.
   */
  async create(actor: Principal, input: RoleInput, meta: RequestMeta): Promise<RoleView> {
    const name = input.name.trim();

    if (name.length < 3) {
      throw AppError.validation('INVALID_NAME', 'Dê um nome ao papel (ao menos 3 letras).');
    }

    const code = await this.prisma.$transaction(async (tx) => {
      if (
        await tx.role.findFirst({
          where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null }
        })
      ) {
        throw AppError.conflict('ROLE_NAME_TAKEN', 'Já existe um papel com esse nome.');
      }

      const base = roleCode(name);
      let candidate = base;

      for (let n = 2; await tx.role.findUnique({ where: { code: candidate } }); n += 1) {
        candidate = `${base}-${n}`;
      }

      const copied = input.copyFrom
        ? await tx.role.findFirst({
            where: { code: input.copyFrom, deletedAt: null },
            select: { rolePermissions: { select: { permission: { select: { code: true } } } } }
          })
        : null;

      if (input.copyFrom && copied === null) {
        throw AppError.validation('INVALID_COPY', 'Papel para copiar não encontrado.');
      }

      const role = await tx.role.create({
        data: { code: candidate, name, description: input.description?.trim() || null }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.created',
          entityType: 'Role',
          entityId: role.id,
          after: { code: candidate, name, copyFrom: input.copyFrom ?? null },
          meta
        },
        tx
      );

      const codes = [
        ...(copied?.rolePermissions.map((rp) => rp.permission.code) ?? []),
        ...(input.permissions ?? [])
      ];

      await this.replacePermissions(tx, actor, role.id, codes);

      return candidate;
    });

    return this.view(code);
  }

  async update(
    actor: Principal,
    code: string,
    input: { name?: string; description?: string | null },
    meta: RequestMeta
  ): Promise<RoleView> {
    const role = await this.prisma.role.findFirst({ where: { code, deletedAt: null } });

    this.assertCustom(role);

    const name = input.name?.trim();

    if (name !== undefined && name.length < 3) {
      throw AppError.validation('INVALID_NAME', 'Dê um nome ao papel (ao menos 3 letras).');
    }

    const current = role as unknown as { id: string; name: string; description: string | null };

    await this.prisma.role.update({
      where: { id: current.id },
      data: {
        ...(name === undefined ? {} : { name }),
        ...(input.description === undefined
          ? {}
          : { description: input.description?.trim() || null })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'role.updated',
      entityType: 'Role',
      entityId: current.id,
      before: { name: current.name, description: current.description },
      after: { name: name ?? current.name, description: input.description ?? current.description },
      meta
    });

    return this.view(code);
  }

  /** Exclusão lógica; antes, retire o papel das pessoas que o têm (ninguém perde acesso sem ver). */
  async remove(actor: Principal, code: string, reason: string, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: { code, deletedAt: null },
        select: { id: true, isSystem: true, name: true, _count: { select: { userRoles: true } } }
      });

      this.assertCustom(role);

      const found = role as unknown as { id: string; name: string; _count: { userRoles: number } };

      if (found._count.userRoles > 0) {
        throw AppError.conflict(
          'ROLE_IN_USE',
          `${found._count.userRoles} pessoa(s) têm este papel. Retire o papel delas em Usuários antes de excluir.`
        );
      }

      await tx.role.update({ where: { id: found.id }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.deleted',
          entityType: 'Role',
          entityId: found.id,
          reason,
          before: { name: found.name },
          meta
        },
        tx
      );
    });
  }

  private async replacePermissions(
    tx: PrismaTx,
    actor: Principal,
    roleId: string,
    permissionCodes: readonly string[]
  ): Promise<string[]> {
    const unique = [...new Set(permissionCodes)];
    const permissions = await tx.permission.findMany({
      where: { code: { in: unique }, deletedAt: null },
      select: { id: true }
    });

    if (permissions.length !== unique.length) {
      throw AppError.validation('UNKNOWN_PERMISSION', 'Permissão inexistente informada.');
    }

    await tx.rolePermission.deleteMany({
      where: { roleId, permissionId: { notIn: permissions.map((p) => p.id) } }
    });
    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id, grantedById: actor.userId })),
      skipDuplicates: true
    });

    return unique.sort();
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

      const unique = await this.replacePermissions(tx, actor, role.id, permissionCodes);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'role.permissions.changed',
          entityType: 'Role',
          entityId: role.id,
          reason,
          before: { permissions: role.rolePermissions.map((rp) => rp.permission.code).sort() },
          after: { permissions: unique },
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
