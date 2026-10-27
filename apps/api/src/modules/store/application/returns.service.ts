import { Injectable } from '@nestjs/common';
import type { Prisma, ReturnResolution } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { type MoneyView, money, moneyView, sum } from '../../../common/domain/money';
import { sha256Hex } from '../../../common/crypto/tokens';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { CardsService } from '../../cards/application/cards.service';
import { PaymentsService } from '../../finance/application/payments.service';
import { lockRow } from '../../finance/application/ledger.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { canReportDefect, canWithdraw, refundForUnits, returnDeadlines } from '../domain/returns';
import { requiresStock } from '../domain/store-rules';
import { InventoryService } from './inventory.service';
import { personalizationOfItem } from './orders.service';

/** Quem pede: conta logada ou visitante com número e código do pedido. */
export type ReturnOwner =
  { readonly userId: string } | { readonly orderNumber: string; readonly code: string };

export interface ReturnView {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly kind: 'WITHDRAWAL' | 'DEFECT';
  readonly status: 'OPEN' | 'AWAITING_ITEM' | 'REFUNDED' | 'RESOLVED' | 'REJECTED';
  readonly description: string | null;
  readonly resolution: ReturnResolution | null;
  readonly response: string | null;
  readonly refundAmount: MoneyView | null;
  readonly items: { orderItemId: string; productName: string; quantity: number }[];
  readonly customerName: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

export interface OrderRights {
  readonly deliveryConfirmedAt: string | null;
  readonly awaitingReceipt: boolean;
  readonly withdrawalUntil: string | null;
  readonly defectUntil: string | null;
  readonly canWithdraw: boolean;
  readonly canReportDefect: boolean;
  /** Unidades de cada item ainda disponíveis para pedir (sem pedido aberto ou atendido). */
  readonly items: {
    orderItemId: string;
    productName: string;
    personalized: boolean;
    available: number;
  }[];
  readonly returns: ReturnView[];
}

const RETURN_INCLUDE = {
  order: { select: { orderNumber: true, customerName: true } },
  items: { include: { orderItem: { select: { productName: true } } } }
} satisfies Prisma.ReturnRequestInclude;

type ReturnRow = Prisma.ReturnRequestGetPayload<{ include: typeof RETURN_INCLUDE }>;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  customerUserId: true,
  customerName: true,
  deliveredAt: true,
  deliveryConfirmedAt: true,
  receiptConfirmedAt: true,
  guestAccessTokenHash: true,
  items: {
    select: {
      id: true,
      productName: true,
      productVariantId: true,
      quantity: true,
      totalAmount: true,
      details: true,
      product: { select: { fulfillmentType: true } }
    }
  },
  payments: { select: { id: true, status: true, amount: true }, orderBy: { createdAt: 'asc' } }
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

/** Pedido ainda aberto ou já atendido segura as unidades (não dá para pedir duas vezes). */
const HOLDING: readonly string[] = ['OPEN', 'AWAITING_ITEM', 'REFUNDED', 'RESOLVED'];

/**
 * Entrega comprovada, desistência e defeito (DT-070). Desistência dentro do prazo não pode
 * ser negada; o estorno é sempre pelo Caixa, vinculado ao pagamento.
 */
@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly inventory: InventoryService,
    private readonly cards: CardsService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
    private readonly staffAlerts: StaffAlertsService
  ) {}

  private view(row: ReturnRow): ReturnView {
    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      kind: row.kind,
      status: row.status,
      description: row.description,
      resolution: row.resolution,
      response: row.response,
      refundAmount: row.refundAmount ? moneyView(row.refundAmount) : null,
      items: row.items.map((item) => ({
        orderItemId: item.orderItemId,
        productName: item.orderItem.productName,
        quantity: item.quantity
      })),
      customerName: row.order.customerName,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null
    };
  }

  private async loadOwned(db: PrismaTx | PrismaService, owner: ReturnOwner, orderId?: string) {
    const where: Prisma.OrderWhereInput =
      'userId' in owner
        ? { id: orderId ?? '', customerUserId: owner.userId }
        : {
            orderNumber: owner.orderNumber.toUpperCase(),
            guestAccessTokenHash: sha256Hex(`order:${owner.code}`)
          };
    const order = await db.order.findFirst({ where, select: ORDER_SELECT });

    if (order === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    return order;
  }

  private async held(db: PrismaTx | PrismaService, orderId: string): Promise<Map<string, number>> {
    const rows = await db.returnRequestItem.findMany({
      where: { returnRequest: { orderId, status: { in: [...HOLDING] as never } } },
      select: { orderItemId: true, quantity: true }
    });
    const map = new Map<string, number>();

    for (const row of rows) {
      map.set(row.orderItemId, (map.get(row.orderItemId) ?? 0) + row.quantity);
    }

    return map;
  }

  private isPersonalized(item: OrderRow['items'][number]): boolean {
    return personalizationOfItem(item.details).length > 0;
  }

  private async rightsOf(order: OrderRow, now: Date): Promise<OrderRights> {
    const held = await this.held(this.prisma, order.id);
    const deadlines = returnDeadlines(order);
    const returns = await this.prisma.returnRequest.findMany({
      where: { orderId: order.id },
      include: RETURN_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    return {
      deliveryConfirmedAt: order.deliveryConfirmedAt?.toISOString() ?? null,
      awaitingReceipt: order.status === 'DELIVERED' && order.deliveryConfirmedAt === null,
      withdrawalUntil: deadlines.withdrawalUntil?.toISOString() ?? null,
      defectUntil: deadlines.defectUntil?.toISOString() ?? null,
      canWithdraw: canWithdraw(order, now),
      canReportDefect: canReportDefect(order, now),
      items: order.items.map((item) => ({
        orderItemId: item.id,
        productName: item.productName,
        personalized: this.isPersonalized(item),
        available: item.quantity - (held.get(item.id) ?? 0)
      })),
      returns: returns.map((row) => this.view(row))
    };
  }

  async rights(owner: ReturnOwner, orderId?: string, now: Date = new Date()): Promise<OrderRights> {
    return this.rightsOf(await this.loadOwned(this.prisma, owner, orderId), now);
  }

  // ---------- Entrega comprovada ----------

  /** "Recebi": o comprador comprova a entrega; os prazos começam agora. */
  async confirmReceipt(owner: ReturnOwner, orderId?: string): Promise<OrderRights> {
    const order = await this.loadOwned(this.prisma, owner, orderId);

    if (order.status !== 'DELIVERED') {
      throw AppError.conflict('NOT_DELIVERED', 'O pedido ainda não foi entregue.');
    }

    if (order.receiptConfirmedAt === null) {
      const now = new Date();

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          receiptConfirmedAt: now,
          ...(order.deliveryConfirmedAt ? {} : { deliveryConfirmedAt: now })
        }
      });
      await this.audit.record({
        actorUserId: 'userId' in owner ? owner.userId : null,
        action: 'order.receipt.confirmed',
        entityType: 'Order',
        entityId: order.id
      });
    }

    return this.rights(owner, orderId);
  }

  /** Foto da entrega anexada pela diretoria; comprova a entrega se ainda não estava. */
  async uploadProof(
    actor: Principal,
    orderId: string,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<{ deliveryConfirmedAt: string }> {
    const confirmedAt = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, deliveryConfirmedAt: true }
      });

      if (order === null) {
        throw AppError.notFound('Pedido não encontrado.');
      }

      if (order.status !== 'DELIVERED') {
        throw AppError.conflict(
          'NOT_DELIVERED',
          'Registre a entrega do pedido antes de anexar a foto.'
        );
      }

      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'CONFIDENTIAL' },
        actor.userId,
        tx
      );
      const at = order.deliveryConfirmedAt ?? new Date();

      await tx.order.update({
        where: { id: orderId },
        data: { deliveryProofMediaFileId: stored.id, deliveryConfirmedAt: at }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.delivery.proof',
          entityType: 'Order',
          entityId: orderId,
          after: { mediaFileId: stored.id },
          meta
        },
        tx
      );

      return at;
    });

    return { deliveryConfirmedAt: confirmedAt.toISOString() };
  }

  // ---------- Pedido do cliente ----------

  async request(
    owner: ReturnOwner,
    input: {
      orderId?: string;
      kind: 'WITHDRAWAL' | 'DEFECT';
      items: readonly { orderItemId: string; quantity: number }[];
      description?: string;
    },
    now: Date = new Date()
  ): Promise<OrderRights> {
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await this.loadOwned(tx, owner, input.orderId);

      await lockRow(tx, 'order', order.id);

      if (input.kind === 'WITHDRAWAL' && !canWithdraw(order, now)) {
        throw AppError.conflict(
          'WITHDRAWAL_EXPIRED',
          'O prazo de 7 dias para desistir desta compra terminou. Se houver defeito, use "Problema com o produto".'
        );
      }

      if (input.kind === 'DEFECT' && !canReportDefect(order, now)) {
        throw AppError.conflict(
          'DEFECT_NOT_ALLOWED',
          order.status === 'DELIVERED'
            ? 'O prazo de 90 dias da garantia terminou.'
            : 'O defeito é relatado depois de receber o produto.'
        );
      }

      const description = input.description?.trim() || null;

      if (input.kind === 'DEFECT' && (description === null || description.length < 10)) {
        throw AppError.validation('DESCRIPTION_REQUIRED', 'Descreva o problema do produto.');
      }

      const held = await this.held(tx, order.id);
      const chosen = input.items.filter((item) => item.quantity > 0);

      if (chosen.length === 0) {
        throw AppError.validation('ITEMS_REQUIRED', 'Escolha ao menos um item.');
      }

      for (const choice of chosen) {
        const item = order.items.find((i) => i.id === choice.orderItemId);

        if (!item) {
          throw AppError.validation('INVALID_ITEM', 'Item não pertence ao pedido.');
        }

        if (input.kind === 'WITHDRAWAL' && this.isPersonalized(item)) {
          throw AppError.conflict(
            'PERSONALIZED_NO_WITHDRAWAL',
            `"${item.productName}" é personalizado: não tem desistência. Se houver defeito, use "Problema com o produto".`
          );
        }

        if (choice.quantity > item.quantity - (held.get(item.id) ?? 0)) {
          throw AppError.conflict(
            'ALREADY_REQUESTED',
            `"${item.productName}" já tem pedido de troca ou devolução para essas unidades.`
          );
        }
      }

      // Nada a devolver fisicamente (não entregue ou só afiliação): só falta o estorno.
      const physical = chosen.some((choice) => {
        const item = order.items.find((i) => i.id === choice.orderItemId);

        return item?.product.fulfillmentType !== 'MEMBERSHIP';
      });
      const row = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          requesterUserId: 'userId' in owner ? owner.userId : null,
          kind: input.kind,
          status:
            input.kind === 'WITHDRAWAL' && physical && order.status === 'DELIVERED'
              ? 'AWAITING_ITEM'
              : 'OPEN',
          description,
          items: {
            create: chosen.map((choice) => ({
              orderItemId: choice.orderItemId,
              quantity: choice.quantity
            }))
          }
        }
      });

      await this.audit.record(
        {
          actorUserId: 'userId' in owner ? owner.userId : null,
          action: input.kind === 'WITHDRAWAL' ? 'order.return.withdrawal' : 'order.return.defect',
          entityType: 'Order',
          entityId: order.id,
          after: { returnRequestId: row.id, items: chosen }
        },
        tx
      );

      return { id: row.id, orderNumber: order.orderNumber, orderId: order.id };
    });

    await this.staffAlerts.alert(PERMISSIONS.ordersRead, {
      type: 'staff.order.return',
      title: input.kind === 'WITHDRAWAL' ? 'Desistência de compra' : 'Problema com produto',
      message: `Pedido ${created.orderNumber}: ${input.kind === 'WITHDRAWAL' ? 'o cliente desistiu da compra' : 'o cliente relatou defeito'}.`,
      link: '/admin/devolucoes',
      key: `staff-return:${created.id}`
    });

    return this.rights(owner, created.orderId);
  }

  // ---------- Diretoria ----------

  async list(query: PageQueryDto & { status?: string }): Promise<Page<ReturnView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const open = ['OPEN', 'AWAITING_ITEM'];
    const where: Prisma.ReturnRequestWhereInput =
      query.status === 'closed'
        ? { status: { notIn: open as never } }
        : { status: { in: open as never } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.returnRequest.findMany({
        where,
        include: RETURN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      this.prisma.returnRequest.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.view(row)),
      total,
      page,
      pageSize
    );
  }

  /**
   * Atende o pedido. Desistência: estorno integral dos itens (não pode ser negada). Defeito:
   * troca, conserto ou estorno; ou recusa com resposta.
   */
  async decide(
    actor: Principal,
    id: string,
    input: { resolution?: ReturnResolution; reject?: boolean; response: string },
    meta: RequestMeta
  ): Promise<ReturnView> {
    const notifyUser = await this.prisma.$transaction(async (tx) => {
      await lockRow(
        tx,
        'order',
        (await tx.returnRequest.findUniqueOrThrow({ where: { id } })).orderId
      );
      const row = await tx.returnRequest.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              orderItem: {
                select: {
                  id: true,
                  productVariantId: true,
                  quantity: true,
                  totalAmount: true,
                  product: { select: { fulfillmentType: true } }
                }
              }
            }
          },
          order: { select: ORDER_SELECT }
        }
      });

      if (row === null) {
        throw AppError.notFound('Pedido de devolução não encontrado.');
      }

      if (row.status !== 'OPEN' && row.status !== 'AWAITING_ITEM') {
        throw AppError.conflict('ALREADY_DECIDED', 'Este pedido já foi atendido.');
      }

      if (row.kind === 'WITHDRAWAL' && input.reject) {
        throw AppError.conflict(
          'WITHDRAWAL_CANNOT_BE_DENIED',
          'Desistência dentro do prazo não pode ser negada (CDC art. 49).'
        );
      }

      const refund = row.kind === 'WITHDRAWAL' || input.resolution === 'REFUND';
      let refundId: string | null = null;
      let refundAmount = money(0);

      if (refund && !input.reject) {
        refundAmount = sum(
          row.items.map((item) =>
            refundForUnits(item.orderItem.totalAmount, item.orderItem.quantity, item.quantity)
          )
        );
        refundId = await this.refundOrder(
          tx,
          actor,
          row.order,
          refundAmount,
          input.response,
          row.id
        );

        for (const item of row.items) {
          // Produto de estoque volta para a prateleira; afiliação é cancelada.
          if (requiresStock(item.orderItem.product.fulfillmentType) && row.kind === 'WITHDRAWAL') {
            await this.inventory.record(tx, {
              variantId: item.orderItem.productVariantId,
              type: 'RETURN',
              quantity: item.quantity,
              orderItemId: item.orderItem.id,
              reason: `Desistência ${row.order.orderNumber}`,
              actorId: actor.userId
            });
          }

          if (item.orderItem.product.fulfillmentType === 'MEMBERSHIP') {
            await this.cards.cancelByOrderItemInTx(tx, item.orderItem.id, input.response);
          }
        }
      }

      await tx.returnRequest.update({
        where: { id },
        data: {
          status: input.reject ? 'REJECTED' : refund ? 'REFUNDED' : 'RESOLVED',
          resolution: input.reject ? null : (input.resolution ?? 'REFUND'),
          response: input.response,
          refundAmount: refund && !input.reject ? refundAmount : null,
          refundId,
          decidedById: actor.userId,
          decidedAt: new Date()
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.return.decided',
          entityType: 'ReturnRequest',
          entityId: id,
          reason: input.response,
          before: { status: row.status },
          after: {
            reject: input.reject ?? false,
            resolution: input.resolution ?? null,
            refundAmount: refund && !input.reject ? refundAmount.toFixed(2) : null
          },
          meta
        },
        tx
      );

      return row.order.customerUserId
        ? {
            userId: row.order.customerUserId,
            orderId: row.orderId,
            orderNumber: row.order.orderNumber
          }
        : null;
    });

    if (notifyUser) {
      await this.notifications.notify({
        userId: notifyUser.userId,
        type: 'order.return.decided',
        title: `Pedido ${notifyUser.orderNumber}: troca ou devolução respondida`,
        message: input.response,
        link: `/minha-conta/pedidos/${notifyUser.orderId}`,
        deduplicationKey: `order-return:${id}`
      });
    }

    const row = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: RETURN_INCLUDE
    });

    return this.view(row);
  }

  /** Estorna o valor pelos pagamentos confirmados do pedido, do mais antigo ao mais novo. */
  private async refundOrder(
    tx: PrismaTx,
    actor: Principal,
    order: OrderRow,
    amount: ReturnType<typeof money>,
    reason: string,
    key: string
  ): Promise<string | null> {
    let remaining = amount;
    let firstRefund: string | null = null;

    for (const payment of order.payments) {
      if (remaining.lte(0)) {
        break;
      }

      if (payment.status !== 'CONFIRMED' && payment.status !== 'PARTIALLY_REFUNDED') {
        continue;
      }

      const refunded = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: 'COMPLETED' },
        _sum: { amount: true }
      });
      const room = money(payment.amount).minus(refunded._sum.amount ?? 0);
      const part = remaining.lt(room) ? remaining : room;

      if (part.lte(0)) {
        continue;
      }

      const refundId = await this.payments.partialRefundInTx(
        tx,
        actor.userId,
        payment.id,
        part,
        reason,
        `return:${key}:${payment.id}`
      );

      firstRefund ??= refundId;
      remaining = remaining.minus(part);
    }

    if (remaining.gt(0.004)) {
      throw AppError.conflict(
        'NOTHING_TO_REFUND',
        'Não há pagamento confirmado suficiente neste pedido para o estorno.'
      );
    }

    return firstRefund;
  }
}
