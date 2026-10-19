import { Injectable } from '@nestjs/common';
import type {
  FinancialAccountType,
  FinancialCategoryNature,
  PaymentMethodType,
  Prisma
} from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { DEFAULT_CURRENCY } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { slugify } from '../../sports/domain/sports-rules';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  SYSTEM_CATEGORY_CODES
} from '../domain/finance-catalog';

export interface AccountView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: FinancialAccountType;
  readonly currency: string;
  readonly institutionName: string | null;
  readonly accountLastFour: string | null;
  readonly isActive: boolean;
}

export interface CategoryView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly nature: FinancialCategoryNature;
  readonly isActive: boolean;
  readonly isSystem: boolean;
}

export interface CostCenterView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface PaymentMethodView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: PaymentMethodType;
  readonly isActive: boolean;
}

/** Semeia contas, categorias e métodos padrão de forma idempotente (por código). */
export async function syncFinanceCatalog(tx: PrismaTx): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    await tx.financialCategory.upsert({
      where: { code: category.code },
      create: { code: category.code, name: category.name, nature: category.nature },
      update: {}
    });
  }

  if ((await tx.financialAccount.count()) === 0) {
    for (const account of DEFAULT_ACCOUNTS) {
      await tx.financialAccount.create({ data: { ...account, currency: DEFAULT_CURRENCY } });
    }
  }

  for (const method of DEFAULT_PAYMENT_METHODS) {
    await tx.paymentMethod.upsert({ where: { code: method.code }, create: method, update: {} });
  }
}

/** Cadastros do Caixa (RCF-002): contas, categorias, centros de custo e métodos. */
@Injectable()
export class FinanceSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private async uniqueCode(
    model: 'financialAccount' | 'financialCategory' | 'costCenter' | 'paymentMethod',
    name: string
  ): Promise<string> {
    const base = slugify(name) || 'item';
    const delegate = this.prisma[model] as unknown as {
      findUnique: (args: {
        where: { code: string };
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };

    for (let n = 1; n < 100; n += 1) {
      const code = n === 1 ? base : `${base}-${n}`;

      if ((await delegate.findUnique({ where: { code }, select: { id: true } })) === null) {
        return code;
      }
    }

    throw AppError.conflict('CODE_UNAVAILABLE', 'Não foi possível gerar código único.');
  }

  async accounts(): Promise<AccountView[]> {
    const rows = await this.prisma.financialAccount.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      currency: row.currency,
      institutionName: row.institutionName,
      accountLastFour: row.accountLastFour,
      isActive: row.isActive
    }));
  }

  async createAccount(
    actor: Principal,
    input: {
      name: string;
      type: FinancialAccountType;
      institutionName?: string;
      accountLastFour?: string;
    },
    meta: RequestMeta
  ): Promise<AccountView> {
    const row = await this.prisma.financialAccount.create({
      data: {
        code: await this.uniqueCode('financialAccount', input.name),
        name: input.name.trim(),
        type: input.type,
        currency: DEFAULT_CURRENCY,
        institutionName: input.institutionName?.trim() || null,
        accountLastFour: input.accountLastFour ?? null
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.account.created',
      entityType: 'FinancialAccount',
      entityId: row.id,
      after: { name: row.name, type: row.type },
      meta
    });

    return (await this.accounts()).find((a) => a.id === row.id) as AccountView;
  }

  async updateAccount(
    actor: Principal,
    id: string,
    input: {
      name?: string;
      institutionName?: string;
      accountLastFour?: string;
      isActive?: boolean;
    },
    meta: RequestMeta
  ): Promise<AccountView> {
    const before = await this.prisma.financialAccount.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Conta não encontrada.');
    }

    await this.prisma.financialAccount.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.institutionName === undefined
          ? {}
          : { institutionName: input.institutionName || null }),
        ...(input.accountLastFour === undefined
          ? {}
          : { accountLastFour: input.accountLastFour || null }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.account.updated',
      entityType: 'FinancialAccount',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: input as Record<string, unknown>,
      meta
    });

    return (await this.accounts()).find((a) => a.id === id) as AccountView;
  }

  async categories(): Promise<CategoryView[]> {
    const rows = await this.prisma.financialCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ nature: 'asc' }, { name: 'asc' }]
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      nature: row.nature,
      isActive: row.isActive,
      isSystem: SYSTEM_CATEGORY_CODES.has(row.code)
    }));
  }

  async createCategory(
    actor: Principal,
    input: { name: string; nature: FinancialCategoryNature },
    meta: RequestMeta
  ): Promise<CategoryView> {
    if (input.nature === 'TRANSFER') {
      throw AppError.validation(
        'INVALID_NATURE',
        'Categorias de transferência são gerenciadas pelo sistema.'
      );
    }

    const row = await this.prisma.financialCategory.create({
      data: {
        code: await this.uniqueCode('financialCategory', input.name),
        name: input.name.trim(),
        nature: input.nature
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.category.created',
      entityType: 'FinancialCategory',
      entityId: row.id,
      after: { name: row.name, nature: row.nature },
      meta
    });

    return (await this.categories()).find((c) => c.id === row.id) as CategoryView;
  }

  /** RF-027: inativar não altera lançamentos históricos; categorias do sistema são fixas. */
  async updateCategory(
    actor: Principal,
    id: string,
    input: { name?: string; isActive?: boolean },
    meta: RequestMeta
  ): Promise<CategoryView> {
    const before = await this.prisma.financialCategory.findFirst({
      where: { id, deletedAt: null }
    });

    if (before === null) {
      throw AppError.notFound('Categoria não encontrada.');
    }

    if (SYSTEM_CATEGORY_CODES.has(before.code) && input.isActive === false) {
      throw AppError.conflict(
        'SYSTEM_CATEGORY',
        'Categorias usadas por lançamentos automáticos não podem ser inativadas.'
      );
    }

    await this.prisma.financialCategory.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.category.updated',
      entityType: 'FinancialCategory',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: input as Record<string, unknown>,
      meta
    });

    return (await this.categories()).find((c) => c.id === id) as CategoryView;
  }

  async costCenters(): Promise<CostCenterView[]> {
    const rows = await this.prisma.costCenter.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.isActive
    }));
  }

  async createCostCenter(
    actor: Principal,
    input: { name: string },
    meta: RequestMeta
  ): Promise<CostCenterView> {
    const row = await this.prisma.costCenter.create({
      data: { code: await this.uniqueCode('costCenter', input.name), name: input.name.trim() }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.cost_center.created',
      entityType: 'CostCenter',
      entityId: row.id,
      after: { name: row.name },
      meta
    });

    return { id: row.id, code: row.code, name: row.name, isActive: row.isActive };
  }

  async updateCostCenter(
    actor: Principal,
    id: string,
    input: { name?: string; isActive?: boolean },
    meta: RequestMeta
  ): Promise<CostCenterView> {
    const data: Prisma.CostCenterUpdateInput = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive })
    };
    const row = await this.prisma.costCenter.update({ where: { id }, data });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.cost_center.updated',
      entityType: 'CostCenter',
      entityId: id,
      after: input as Record<string, unknown>,
      meta
    });

    return { id: row.id, code: row.code, name: row.name, isActive: row.isActive };
  }

  async paymentMethods(): Promise<PaymentMethodView[]> {
    const rows = await this.prisma.paymentMethod.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      isActive: row.isActive
    }));
  }

  async setPaymentMethodActive(
    actor: Principal,
    id: string,
    isActive: boolean,
    meta: RequestMeta
  ): Promise<PaymentMethodView> {
    const row = await this.prisma.paymentMethod.update({ where: { id }, data: { isActive } });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'finance.payment_method.updated',
      entityType: 'PaymentMethod',
      entityId: id,
      after: { isActive },
      meta
    });

    return { id: row.id, code: row.code, name: row.name, type: row.type, isActive: row.isActive };
  }
}
