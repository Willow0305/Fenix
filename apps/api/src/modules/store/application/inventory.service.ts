import { Injectable } from '@nestjs/common';
import type { InventoryMovementType } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { lockRow } from '../../finance/application/ledger.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { requiresStock, signedDelta, stockCameBack } from '../domain/store-rules';

export interface StockLevel {
  readonly available: number;
  readonly reserved: number;
  readonly onHand: number;
}

export interface MovementView {
  readonly id: string;
  readonly type: InventoryMovementType;
  readonly quantityDelta: number;
  readonly reason: string | null;
  readonly orderItemId: string | null;
  readonly occurredAt: string;
  readonly createdBy: string | null;
}

/**
 * Estoque como razão de movimentações (RF-016, RN-LOJ-005/006). Nunca há quantidade
 * editável: disponível = soma dos deltas; reservas são somadas à parte.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  async levels(variantIds: readonly string[], tx?: PrismaTx): Promise<Map<string, StockLevel>> {
    const client = tx ?? this.prisma;
    const result = new Map<string, StockLevel>();

    if (variantIds.length === 0) {
      return result;
    }

    const grouped = await client.inventoryMovement.groupBy({
      by: ['productVariantId', 'type'],
      where: { productVariantId: { in: [...variantIds] } },
      _sum: { quantityDelta: true }
    });

    for (const id of variantIds) {
      const rows = grouped.filter((row) => row.productVariantId === id);
      const available = rows.reduce((total, row) => total + (row._sum.quantityDelta ?? 0), 0);
      const reservedNet = rows
        .filter((row) => row.type === 'RESERVATION' || row.type === 'RELEASE')
        .reduce((total, row) => total + (row._sum.quantityDelta ?? 0), 0);
      const reserved = reservedNet === 0 ? 0 : -reservedNet;

      result.set(id, { available, reserved, onHand: available + reserved });
    }

    return result;
  }

  async record(
    tx: PrismaTx,
    input: {
      variantId: string;
      type: InventoryMovementType;
      quantity: number;
      reason?: string | null;
      orderItemId?: string | null;
      actorId: string | null;
    }
  ): Promise<void> {
    const delta = signedDelta(input.type, input.quantity);
    // Só consulta o saldo anterior quando alguém pediu aviso desta variação.
    const waiting =
      delta > 0 ? await tx.stockAlert.count({ where: { productVariantId: input.variantId } }) : 0;
    const before =
      waiting > 0 ? (await this.levels([input.variantId], tx)).get(input.variantId) : undefined;

    await tx.inventoryMovement.create({
      data: {
        productVariantId: input.variantId,
        type: input.type,
        quantityDelta: delta,
        reason: input.reason ?? null,
        orderItemId: input.orderItemId ?? null,
        createdById: input.actorId
      }
    });

    if (before && stockCameBack(before.available, delta)) {
      await this.notifyStockBack(tx, input.variantId);
    }
  }

  /**
   * "Avise-me quando chegar" (DT-081): avisa quem pediu e apaga os pedidos na mesma transação.
   * Se o movimento for desfeito (rollback), nem o aviso nem a exclusão acontecem.
   */
  private async notifyStockBack(tx: PrismaTx, variantId: string): Promise<void> {
    const alerts = await tx.stockAlert.findMany({
      where: { productVariantId: variantId },
      select: {
        id: true,
        userId: true,
        productVariant: { select: { name: true, product: { select: { name: true, slug: true } } } }
      }
    });

    if (alerts.length === 0) {
      return;
    }

    await this.notifications.notify(
      alerts.map((alert) => ({
        userId: alert.userId,
        type: 'store.stock_back',
        title: `Chegou: ${alert.productVariant.product.name}`,
        message: `${alert.productVariant.product.name} (${alert.productVariant.name}) voltou ao estoque.`,
        link: `/loja/${alert.productVariant.product.slug}`,
        deduplicationKey: `stock-back:${alert.id}`
      })),
      tx
    );
    await tx.stockAlert.deleteMany({ where: { id: { in: alerts.map((alert) => alert.id) } } });
  }

  /** Variações desta lista em que a pessoa pediu aviso. */
  async alertsOf(userId: string, variantIds: readonly string[]): Promise<string[]> {
    const rows = await this.prisma.stockAlert.findMany({
      where: { userId, productVariantId: { in: [...variantIds] } },
      select: { productVariantId: true }
    });

    return rows.map((row) => row.productVariantId);
  }

  /** Pede o aviso: só variação esgotada de produto vendido com estoque. */
  async requestAlert(userId: string, variantId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        deletedAt: null,
        product: { deletedAt: null, status: { in: ['ACTIVE', 'SOLD_OUT'] } }
      },
      select: { product: { select: { fulfillmentType: true } } }
    });

    if (variant === null || !requiresStock(variant.product.fulfillmentType)) {
      throw AppError.notFound('Produto não encontrado.');
    }

    const level = (await this.levels([variantId])).get(variantId);

    if ((level?.available ?? 0) > 0) {
      throw AppError.conflict('IN_STOCK', 'Este produto já está disponível. Adicione ao carrinho.');
    }

    await this.prisma.stockAlert.createMany({
      data: [{ userId, productVariantId: variantId }],
      skipDuplicates: true
    });
  }

  async cancelAlert(userId: string, variantId: string): Promise<void> {
    await this.prisma.stockAlert.deleteMany({ where: { userId, productVariantId: variantId } });
  }

  /** Entrada, perda ou ajuste manual: exige permissão, motivo e fica auditado (RN-LOJ-006). */
  async adjust(
    actor: Principal,
    variantId: string,
    input: { type: 'STOCK_IN' | 'LOSS' | 'ADJUSTMENT'; quantity: number; reason: string },
    meta: RequestMeta
  ): Promise<StockLevel> {
    if (input.quantity === 0 || (input.type !== 'ADJUSTMENT' && input.quantity < 0)) {
      throw AppError.validation(
        'INVALID_QUANTITY',
        'Quantidade inválida para o tipo de movimento.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'variant', variantId);
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, deletedAt: null },
        select: { sku: true }
      });

      if (variant === null) {
        throw AppError.notFound('Variação não encontrada.');
      }

      const before = (await this.levels([variantId], tx)).get(variantId) as StockLevel;
      const delta = signedDelta(input.type, input.quantity);

      if (before.available + delta < 0) {
        throw AppError.conflict(
          'NEGATIVE_STOCK',
          `O ajuste deixaria o estoque disponível negativo (disponível: ${before.available}).`
        );
      }

      await this.record(tx, {
        variantId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        actorId: actor.userId
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'inventory.adjusted',
          entityType: 'ProductVariant',
          entityId: variantId,
          reason: input.reason,
          before: { available: before.available },
          after: {
            available: before.available + delta,
            type: input.type,
            quantity: input.quantity,
            sku: variant.sku
          },
          meta
        },
        tx
      );
    });

    return (await this.levels([variantId])).get(variantId) as StockLevel;
  }

  async movements(variantId: string): Promise<MovementView[]> {
    const rows = await this.prisma.inventoryMovement.findMany({
      where: { productVariantId: variantId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      include: { createdBy: { select: { name: true } } }
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      quantityDelta: row.quantityDelta,
      reason: row.reason,
      orderItemId: row.orderItemId,
      occurredAt: row.occurredAt.toISOString(),
      createdBy: row.createdBy?.name ?? null
    }));
  }
}
