import { Injectable } from '@nestjs/common';
import type { CouponAudience, CouponDiscountType, CouponScope, Prisma } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { type Money, moneyView, type MoneyView, sum, ZERO } from '../../../common/domain/money';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { lockRow } from '../../finance/application/ledger.service';
import {
  type CouponLine,
  type CouponRule,
  evaluateCoupon,
  normalizeCouponCode
} from '../domain/coupon-rules';
import { lineTotal } from '../domain/store-rules';
import { cartItemPrice, type CartOwner, CartService } from './cart.service';

export interface CouponInput {
  readonly code: string;
  readonly description?: string | null;
  readonly discountType: CouponDiscountType;
  readonly percentage?: Money | null;
  readonly amount?: Money | null;
  readonly scope: CouponScope;
  readonly audience: CouponAudience;
  readonly minimumOrderAmount?: Money | null;
  readonly startsAt?: string | null;
  readonly endsAt?: string | null;
  readonly maxRedemptions?: number | null;
  readonly maxPerCustomer?: number | null;
  readonly isActive?: boolean;
  readonly productIds?: readonly string[];
  readonly categoryIds?: readonly string[];
  readonly roleIds?: readonly string[];
}

export interface CouponView {
  readonly id: string;
  readonly code: string;
  readonly description: string | null;
  readonly discountType: CouponDiscountType;
  readonly percentage: string | null;
  readonly amount: MoneyView | null;
  readonly scope: CouponScope;
  readonly audience: CouponAudience;
  readonly minimumOrderAmount: MoneyView | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly maxRedemptions: number | null;
  readonly maxPerCustomer: number | null;
  readonly isActive: boolean;
  readonly products: { id: string; name: string }[];
  readonly categories: { id: string; name: string }[];
  readonly roles: { id: string; code: string; name: string }[];
  /** Usos válidos (pedidos não cancelados). */
  readonly redemptions: number;
  readonly totalDiscount: MoneyView;
  readonly createdAt: string;
}

export interface CouponRedemptionView {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly discountAmount: MoneyView;
  readonly status: 'ACTIVE' | 'RELEASED';
  readonly createdAt: string;
}

export interface CouponPreview {
  readonly code: string;
  readonly subtotal: MoneyView;
  readonly discount: MoneyView;
  readonly total: MoneyView;
  readonly eligibleSubtotal: MoneyView;
}

export interface AppliedCoupon {
  readonly couponId: string;
  readonly code: string;
  readonly discount: Money;
  readonly perLine: readonly Money[];
}

const COUPON_INCLUDE = {
  products: { include: { product: { select: { id: true, name: true } } } },
  categories: { include: { category: { select: { id: true, name: true } } } },
  roles: { include: { role: { select: { id: true, code: true, name: true } } } }
} satisfies Prisma.CouponInclude;

type CouponRow = Prisma.CouponGetPayload<{ include: typeof COUPON_INCLUDE }>;

/**
 * Cupons de desconto da loja (DT-045): cadastro pela diretoria, prévia no carrinho e
 * aplicação no fechamento do pedido, com trava da linha do cupom para o limite de usos
 * valer mesmo com pedidos simultâneos.
 */
@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly carts: CartService
  ) {}

  private toRule(row: CouponRow): CouponRule {
    return {
      code: row.code,
      discountType: row.discountType,
      percentage: row.percentage,
      amount: row.amount,
      scope: row.scope,
      audience: row.audience,
      minimumOrderAmount: row.minimumOrderAmount,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      maxRedemptions: row.maxRedemptions,
      maxPerCustomer: row.maxPerCustomer,
      isActive: row.isActive,
      productIds: new Set(row.products.map((p) => p.productId)),
      categoryIds: new Set(row.categories.map((c) => c.productCategoryId)),
      roleCodes: new Set(row.roles.map((r) => r.role.code))
    };
  }

  private async toViews(rows: CouponRow[]): Promise<CouponView[]> {
    const stats = await this.prisma.couponRedemption.groupBy({
      by: ['couponId'],
      where: { couponId: { in: rows.map((r) => r.id) }, status: 'ACTIVE' },
      _count: { _all: true },
      _sum: { discountAmount: true }
    });
    const byId = new Map(stats.map((s) => [s.couponId, s]));

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      discountType: row.discountType,
      percentage: row.percentage?.toFixed(2) ?? null,
      amount: row.amount ? moneyView(row.amount, row.currency) : null,
      scope: row.scope,
      audience: row.audience,
      minimumOrderAmount: row.minimumOrderAmount
        ? moneyView(row.minimumOrderAmount, row.currency)
        : null,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      maxRedemptions: row.maxRedemptions,
      maxPerCustomer: row.maxPerCustomer,
      isActive: row.isActive,
      products: row.products.map((p) => p.product),
      categories: row.categories.map((c) => c.category),
      roles: row.roles.map((r) => r.role),
      redemptions: byId.get(row.id)?._count._all ?? 0,
      totalDiscount: moneyView(byId.get(row.id)?._sum.discountAmount ?? ZERO, row.currency),
      createdAt: row.createdAt.toISOString()
    }));
  }

  async list(): Promise<CouponView[]> {
    const rows = await this.prisma.coupon.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: COUPON_INCLUDE
    });

    return this.toViews(rows);
  }

  async get(id: string): Promise<CouponView> {
    const row = await this.prisma.coupon.findFirst({
      where: { id, deletedAt: null },
      include: COUPON_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Cupom não encontrado.');
    }

    const [view] = await this.toViews([row]);

    return view as CouponView;
  }

  /** Tipo, valor, alvos e datas coerentes; código único (sem diferenciar maiúsculas). */
  private async validate(input: CouponInput, ignoreId?: string): Promise<string> {
    const code = normalizeCouponCode(input.code);
    const errors = [];

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      errors.push({
        field: 'code',
        code: 'INVALID_CODE',
        message: 'Use de 3 a 40 letras, números, "-" ou "_", sem espaços.'
      });
    }

    if (input.discountType === 'PERCENTAGE' && !input.percentage) {
      errors.push({ field: 'percentage', code: 'REQUIRED', message: 'Informe o percentual.' });
    }

    if (input.discountType === 'FIXED' && !input.amount) {
      errors.push({ field: 'amount', code: 'REQUIRED', message: 'Informe o valor do desconto.' });
    }

    if (input.scope === 'PRODUCTS' && !input.productIds?.length) {
      errors.push({
        field: 'productIds',
        code: 'REQUIRED',
        message: 'Escolha ao menos um produto.'
      });
    }

    if (input.scope === 'CATEGORIES' && !input.categoryIds?.length) {
      errors.push({
        field: 'categoryIds',
        code: 'REQUIRED',
        message: 'Escolha ao menos uma categoria.'
      });
    }

    if (input.audience === 'ROLES' && !input.roleIds?.length) {
      errors.push({ field: 'roleIds', code: 'REQUIRED', message: 'Escolha ao menos um público.' });
    }

    if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
      errors.push({
        field: 'endsAt',
        code: 'INVALID_PERIOD',
        message: 'O fim precisa ser depois do início.'
      });
    }

    if (errors.length > 0) {
      throw AppError.validation('COUPON_INVALID', 'Revise os dados do cupom.', errors);
    }

    const existing = await this.prisma.coupon.findFirst({
      where: { code, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true }
    });

    if (existing) {
      throw AppError.conflict('COUPON_CODE_TAKEN', `Já existe um cupom com o código ${code}.`);
    }

    return code;
  }

  private data(input: CouponInput, code: string) {
    return {
      code,
      description: input.description?.trim() || null,
      discountType: input.discountType,
      percentage: input.discountType === 'PERCENTAGE' ? (input.percentage ?? null) : null,
      amount: input.discountType === 'FIXED' ? (input.amount ?? null) : null,
      scope: input.scope,
      audience: input.audience,
      minimumOrderAmount: input.minimumOrderAmount ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      maxRedemptions: input.maxRedemptions ?? null,
      maxPerCustomer: input.maxPerCustomer ?? null,
      isActive: input.isActive ?? true
    };
  }

  private async replaceTargets(tx: PrismaTx, couponId: string, input: CouponInput): Promise<void> {
    await tx.couponProduct.deleteMany({ where: { couponId } });
    await tx.couponCategory.deleteMany({ where: { couponId } });
    await tx.couponRole.deleteMany({ where: { couponId } });

    if (input.scope === 'PRODUCTS') {
      await tx.couponProduct.createMany({
        data: [...new Set(input.productIds)].map((productId) => ({ couponId, productId }))
      });
    }

    if (input.scope === 'CATEGORIES') {
      await tx.couponCategory.createMany({
        data: [...new Set(input.categoryIds)].map((productCategoryId) => ({
          couponId,
          productCategoryId
        }))
      });
    }

    if (input.audience === 'ROLES') {
      await tx.couponRole.createMany({
        data: [...new Set(input.roleIds)].map((roleId) => ({ couponId, roleId }))
      });
    }
  }

  private auditData(input: CouponInput, code: string): Record<string, unknown> {
    return {
      code,
      discountType: input.discountType,
      percentage: input.percentage?.toFixed(2) ?? null,
      amount: input.amount?.toFixed(2) ?? null,
      scope: input.scope,
      audience: input.audience,
      maxRedemptions: input.maxRedemptions ?? null,
      maxPerCustomer: input.maxPerCustomer ?? null,
      isActive: input.isActive ?? true
    };
  }

  async create(actor: Principal, input: CouponInput, meta: RequestMeta): Promise<CouponView> {
    const code = await this.validate(input);
    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.coupon.create({
        data: { ...this.data(input, code), createdById: actor.userId }
      });

      await this.replaceTargets(tx, created.id, input);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'coupon.created',
          entityType: 'Coupon',
          entityId: created.id,
          after: this.auditData(input, code),
          meta
        },
        tx
      );

      return created.id;
    });

    return this.get(id);
  }

  async update(
    actor: Principal,
    id: string,
    input: CouponInput,
    meta: RequestMeta
  ): Promise<CouponView> {
    const before = await this.get(id);
    const code = await this.validate(input, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id }, data: this.data(input, code) });
      await this.replaceTargets(tx, id, input);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'coupon.updated',
          entityType: 'Coupon',
          entityId: id,
          before: { code: before.code, isActive: before.isActive, redemptions: before.redemptions },
          after: this.auditData(input, code),
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  async setActive(
    actor: Principal,
    id: string,
    isActive: boolean,
    meta: RequestMeta
  ): Promise<CouponView> {
    await this.get(id);
    await this.prisma.coupon.update({ where: { id }, data: { isActive } });
    await this.audit.record({
      actorUserId: actor.userId,
      action: isActive ? 'coupon.activated' : 'coupon.deactivated',
      entityType: 'Coupon',
      entityId: id,
      meta
    });

    return this.get(id);
  }

  /** Exclusão lógica só de cupom nunca usado; usado, inative (o histórico fica). */
  async delete(actor: Principal, id: string, reason: string, meta: RequestMeta): Promise<void> {
    await softDeleteIfUnused({
      prisma: this.prisma,
      audit: this.audit,
      actor,
      meta,
      reason,
      entityId: id,
      entityType: 'Coupon',
      action: 'coupon.deleted',
      noun: 'o cupom',
      load: async (tx) => {
        const row = await tx.coupon.findFirst({
          where: { id, deletedAt: null },
          select: { code: true }
        });

        return row ? { name: row.code } : null;
      },
      usage: async (tx) => [
        {
          count: await tx.couponRedemption.count({ where: { couponId: id } }),
          label: 'pedido(s)'
        }
      ],
      remove: (tx) =>
        tx.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    });
  }

  async redemptions(id: string): Promise<CouponRedemptionView[]> {
    await this.get(id);

    const rows = await this.prisma.couponRedemption.findMany({
      where: { couponId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { order: { select: { id: true, orderNumber: true, customerName: true } } }
    });

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order.id,
      orderNumber: row.order.orderNumber,
      customerName: row.order.customerName,
      discountAmount: moneyView(row.discountAmount, row.currency),
      status: row.status,
      createdAt: row.createdAt.toISOString()
    }));
  }

  // ---------- Uso no carrinho e no pedido ----------

  private async evaluate(
    db: PrismaService | PrismaTx,
    rawCode: string,
    principal: Principal | undefined,
    customerEmail: string | null,
    lines: readonly CouponLine[]
  ) {
    const row = await db.coupon.findFirst({
      where: { code: normalizeCouponCode(rawCode), deletedAt: null },
      include: COUPON_INCLUDE
    });

    if (row === null) {
      throw AppError.validation('COUPON_NOT_FOUND', 'Cupom não encontrado. Confira o código.', [
        { field: 'couponCode', code: 'COUPON_NOT_FOUND', message: 'Cupom não encontrado.' }
      ]);
    }

    const active = { couponId: row.id, status: 'ACTIVE' as const };
    const [total, byCustomer] = await Promise.all([
      db.couponRedemption.count({ where: active }),
      principal || customerEmail
        ? db.couponRedemption.count({
            where: {
              ...active,
              OR: [
                ...(principal ? [{ userId: principal.userId }] : []),
                ...(customerEmail ? [{ customerEmail }] : [])
              ]
            }
          })
        : Promise.resolve(0)
    ]);
    const result = evaluateCoupon(this.toRule(row), lines, {
      now: new Date(),
      roles: principal ? [...principal.roles] : null,
      usage: { total, byCustomer }
    });

    if (!result.ok) {
      throw AppError.validation('COUPON_REFUSED', result.message, [
        { field: 'couponCode', code: result.refusal, message: result.message }
      ]);
    }

    return { row, result };
  }

  /** Prévia no carrinho: não reserva o cupom; o fechamento confere de novo. */
  async preview(owner: CartOwner, code: string): Promise<CouponPreview> {
    const cart = await this.carts.findActive(owner);

    if (cart === null || cart.items.length === 0) {
      throw AppError.validation('EMPTY_CART', 'Seu carrinho está vazio.');
    }

    const lines = cart.items.map((item) => ({
      productId: item.productVariant.product.id,
      categoryId: item.productVariant.product.productCategoryId,
      partnerId: item.productVariant.product.partnerId,
      total: lineTotal({ unitPrice: cartItemPrice(item), quantity: item.quantity })
    }));
    const { row, result } = await this.evaluate(this.prisma, code, owner.principal, null, lines);
    const subtotal = sum(lines.map((line) => line.total));

    return {
      code: row.code,
      subtotal: moneyView(subtotal),
      discount: moneyView(result.discount),
      total: moneyView(subtotal.minus(result.discount)),
      eligibleSubtotal: moneyView(result.eligibleSubtotal)
    };
  }

  /** No fechamento do pedido, dentro da transação: trava o cupom e confere tudo de novo. */
  async applyInTx(
    tx: PrismaTx,
    code: string,
    principal: Principal | undefined,
    customerEmail: string,
    lines: readonly CouponLine[]
  ): Promise<AppliedCoupon> {
    const found = await tx.coupon.findFirst({
      where: { code: normalizeCouponCode(code), deletedAt: null },
      select: { id: true }
    });

    if (found) {
      await lockRow(tx, 'coupon', found.id);
    }

    const { row, result } = await this.evaluate(tx, code, principal, customerEmail, lines);

    return { couponId: row.id, code: row.code, discount: result.discount, perLine: result.perLine };
  }

  async redeemInTx(
    tx: PrismaTx,
    applied: AppliedCoupon,
    orderId: string,
    userId: string | null,
    customerEmail: string
  ): Promise<void> {
    await tx.couponRedemption.create({
      data: {
        couponId: applied.couponId,
        orderId,
        userId,
        customerEmail,
        discountAmount: applied.discount,
        currency: 'BRL'
      }
    });
  }

  /** Pedido cancelado, expirado ou estornado libera o uso do cupom. */
  async releaseInTx(tx: PrismaTx, orderId: string): Promise<void> {
    await tx.couponRedemption.updateMany({
      where: { orderId, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() }
    });
  }
}
