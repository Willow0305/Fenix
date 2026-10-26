import { Injectable } from '@nestjs/common';
import type { InventoryMovementType } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { lockRow } from '../../finance/application/ledger.service';
import { signedDelta } from '../domain/store-rules';

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
    private readonly audit: AuditService
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
    await tx.inventoryMovement.create({
      data: {
        productVariantId: input.variantId,
        type: input.type,
        quantityDelta: signedDelta(input.type, input.quantity),
        reason: input.reason ?? null,
        orderItemId: input.orderItemId ?? null,
        createdById: input.actorId
      }
    });
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
