import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { OrderStatus } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { money } from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import { SiteRevalidateService } from '../../../common/http/site-revalidate.interceptor';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import { PaymentsService } from '../../finance/application/payments.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  isPaidState,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  orderStatusCountsAsUnread
} from '../domain/store-rules';
import { CouponsService } from './coupons.service';
import { InventoryService } from './inventory.service';
import { CardsService } from '../../member-cards/application/cards.service';
import { strongerProof } from '../domain/delivery';
import { guestCodeHash } from '../domain/guest-access';
import { GuestMessagesService } from './guest-messages.service';
import { OrderView, OrderRow } from './order-view';
import { OrderReader } from './order-view';

/**
 * Situação do pedido (RF-018, DT-031): transições da diretoria, cancelamento pelo comprador e
 * pelo sistema, pronto para retirada, retirado e reserva vencida. Cancelar desfaz estoque,
 * cupom, carteirinha e pagamentos pendentes.
 */
@Injectable()
export class OrderStatusService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly coupons: CouponsService,
    private readonly jobs: JobScheduler,
    private readonly site: SiteRevalidateService,
    private readonly cards: CardsService,
    private readonly guestMessages: GuestMessagesService,
    private readonly reader: OrderReader
  ) {}

  onModuleInit(): void {
    // Reserva vencida devolve estoque: a loja aberta no navegador se atualiza (DT-051). A cada
    // 2 minutos, porque o pedido PIX vence em 30 (DT-076).
    this.jobs.every('store.orders.expire', 2 * 60_000, async () => {
      if ((await this.expireStale()) > 0) {
        this.site.changed(['store']);
      }
    });
  }

  private async notifyStatus(tx: PrismaTx, row: OrderRow, status: OrderStatus): Promise<void> {
    if (!row.customerUserId) {
      // Sem conta: o mesmo aviso por e-mail e WhatsApp (DT-096).
      await this.guestMessages.enqueue(
        tx,
        row,
        `status:${status}`,
        `Pedido ${row.orderNumber}: ${ORDER_STATUS_LABELS[status]}`,
        status === 'READY_FOR_PICKUP'
          ? 'Seu pedido está pronto para retirada.'
          : status === 'OUT_FOR_DELIVERY'
            ? 'Seu pedido saiu para entrega no endereço informado.'
            : status === 'DELIVERED'
              ? 'Pedido entregue. Na página do pedido, toque em "Recebi" para confirmar; os prazos de troca contam a partir daí.'
              : status === 'CANCELLED'
                ? 'Seu pedido foi cancelado. Se houve pagamento, o estorno segue pelo mesmo meio.'
                : `A situação do seu pedido mudou para "${ORDER_STATUS_LABELS[status]}".`
      );

      return;
    }

    await this.notifications.notify(
      {
        userId: row.customerUserId,
        type: 'order.status',
        title: `Pedido ${row.orderNumber}: ${ORDER_STATUS_LABELS[status]}`,
        message:
          status === 'READY_FOR_PICKUP'
            ? 'Seu pedido está pronto para retirada.'
            : status === 'OUT_FOR_DELIVERY'
              ? 'Seu pedido saiu para entrega no endereço informado.'
              : status === 'PROCESSING' && row.status === 'OUT_FOR_DELIVERY'
                ? 'Não conseguimos entregar desta vez. Vamos combinar uma nova entrega.'
                : status === 'DELIVERED'
                  ? 'Pedido entregue. Toque em "Recebi" em Meus pedidos para confirmar; os prazos de troca contam a partir daí.'
                  : `A situação do seu pedido mudou para "${ORDER_STATUS_LABELS[status]}".`,
        link: `/minha-conta/pedidos/${row.id}`,
        deduplicationKey: `order-status:${row.id}:${status}`,
        countsAsUnread: orderStatusCountsAsUnread(status)
      },
      tx
    );
  }

  /** Desfaz efeitos de estoque/pagamento ao cancelar ou reembolsar (RN-LOJ-010). */
  private async unwind(
    tx: PrismaTx,
    actorId: string | null,
    row: OrderRow,
    reason: string,
    restock: boolean,
    keyBase: string
  ): Promise<void> {
    const settling = await tx.partnerSettlementItem.count({
      where: {
        orderItem: { orderId: row.id },
        partnerSettlement: { status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } }
      }
    });

    // Item em repasse ainda não pago: cancele o repasse antes, para não repassar venda estornada.
    if (settling > 0) {
      throw AppError.conflict(
        'IN_PARTNER_SETTLEMENT',
        `O pedido ${row.orderNumber} está em um repasse a parceiro em andamento. Cancele o repasse antes de estornar.`
      );
    }

    // Pedido cancelado, expirado ou estornado não conta como uso do cupom (DT-045).
    await this.coupons.releaseInTx(tx, row.id);
    // Afiliação desfeita junto: carteirinha cancelada ou renovação revertida (DT-068).
    await this.cards.cancelAffiliationsInTx(tx, row.id, reason);

    for (const item of row.items) {
      const reserved = await tx.inventoryMovement.aggregate({
        where: { orderItemId: item.id, type: { in: ['RESERVATION', 'RELEASE'] } },
        _sum: { quantityDelta: true }
      });
      const outstanding = -(reserved._sum.quantityDelta ?? 0);

      if (outstanding > 0) {
        await this.inventory.record(tx, {
          variantId: item.productVariantId,
          type: 'RELEASE',
          quantity: outstanding,
          orderItemId: item.id,
          reason,
          actorId
        });
      }

      if (restock) {
        const sold = await tx.inventoryMovement.aggregate({
          where: { orderItemId: item.id, type: { in: ['STOCK_OUT', 'RETURN'] } },
          _sum: { quantityDelta: true }
        });
        const out = -(sold._sum.quantityDelta ?? 0);

        if (out > 0) {
          await this.inventory.record(tx, {
            variantId: item.productVariantId,
            type: 'RETURN',
            quantity: out,
            orderItemId: item.id,
            reason,
            actorId
          });
        }
      }
    }

    for (const payment of row.payments.filter(
      (p) => p.status === 'CONFIRMED' || p.status === 'PENDING'
    )) {
      await this.payments.reverseInTx(tx, actorId, payment.id, reason, `${keyBase}:${payment.id}`);
    }

    // Pagamento com reembolso parcial (desistência de item, DT-070): devolve o restante.
    for (const payment of row.payments.filter((p) => p.status === 'PARTIALLY_REFUNDED')) {
      const refunded = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: 'COMPLETED' },
        _sum: { amount: true }
      });
      const remaining = money(payment.amount).minus(refunded._sum.amount ?? 0);

      if (remaining.gt(0)) {
        await this.payments.partialRefundInTx(
          tx,
          actorId,
          payment.id,
          remaining,
          reason,
          `${keyBase}:rest:${payment.id}`
        );
      }
    }
  }

  async changeStatus(
    actor: Principal,
    id: string,
    status: OrderStatus,
    input: { reason?: string; restock?: boolean },
    meta: RequestMeta
  ): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', id);
      const row = await this.reader.load(tx, id);

      assertTransition(ORDER_TRANSITIONS, row.status, status, ORDER_STATUS_LABELS);

      if ((status === 'CANCELLED' || status === 'REFUNDED') && !input.reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo.');
      }

      // Retirada e entrega em casa têm caminhos próprios (DT-075).
      if (status === 'READY_FOR_PICKUP' && row.fulfillment === 'DELIVERY') {
        throw AppError.conflict(
          'DELIVERY_ORDER',
          'Este pedido é de entrega em casa: use "Saiu para entrega".'
        );
      }

      if (status === 'OUT_FOR_DELIVERY') {
        throw AppError.conflict(
          row.fulfillment === 'DELIVERY' ? 'USE_DISPATCH' : 'PICKUP_ORDER',
          row.fulfillment === 'DELIVERY'
            ? 'Registre a saída no quadro "Entrega" do pedido: ele gera o código e o link do entregador.'
            : 'Este pedido é de retirada: use "Pronto para retirada".'
        );
      }

      if (row.status === 'OUT_FOR_DELIVERY' && status === 'PROCESSING' && !input.reason) {
        throw AppError.validation(
          'REASON_REQUIRED',
          'Conte o que aconteceu na entrega (ex.: ninguém em casa).'
        );
      }

      // A saída em andamento fecha junto: entregue (só pela diretoria), sem sucesso ou cancelada.
      if (row.status === 'OUT_FOR_DELIVERY') {
        await tx.deliveryAttempt.updateMany({
          where: { orderId: id, status: 'OUT' },
          data: {
            status:
              status === 'DELIVERED'
                ? 'DELIVERED'
                : status === 'CANCELLED'
                  ? 'CANCELLED'
                  : 'FAILED',
            finishedAt: new Date(),
            failureReason: status === 'DELIVERED' ? null : (input.reason ?? null),
            linkTokenHash: null
          }
        });
      }

      if (
        (status === 'CANCELLED' || status === 'REFUNDED') &&
        isPaidState(row.status) &&
        !actor.permissions.has(PERMISSIONS.paymentsCorrect)
      ) {
        throw AppError.forbidden('Cancelar pedido pago exige permissão de estorno.');
      }

      const now = new Date();

      if (status === 'CANCELLED' || status === 'REFUNDED') {
        await this.unwind(
          tx,
          actor.userId,
          row,
          input.reason as string,
          input.restock ?? true,
          `order-${status.toLowerCase()}:${id}`
        );
      }

      await tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === 'READY_FOR_PICKUP' ? { readyForPickupAt: now } : {}),
          ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
          // Entregue marcado só pela diretoria: prova fraca, abre o "Não recebi" (RN-ENT-006).
          ...(status === 'DELIVERED' && row.fulfillment === 'DELIVERY'
            ? { deliveryProofKind: strongerProof(row.deliveryProofKind, 'STAFF_ONLY') }
            : {}),
          ...(status === 'CANCELLED' || status === 'REFUNDED'
            ? { cancelledAt: now, cancellationReason: input.reason ?? null }
            : {})
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.status.changed',
          entityType: 'Order',
          entityId: id,
          reason: input.reason ?? null,
          before: { status: row.status },
          after: { status, restock: input.restock ?? null },
          meta
        },
        tx
      );
      await this.notifyStatus(tx, row, status);
    });

    return this.reader.get(id);
  }

  /** Cancelamento sistêmico (ex.: remessa cancelada): estorna pagamentos e libera reservas. */
  async systemCancelInTx(
    tx: PrismaTx,
    actorId: string | null,
    orderId: string,
    reason: string,
    restock = false
  ): Promise<boolean> {
    await lockRow(tx, 'order', orderId);
    const row = await this.reader.load(tx, orderId);

    if (row.status === 'CANCELLED' || row.status === 'REFUNDED' || row.status === 'DELIVERED') {
      return false;
    }

    await this.unwind(tx, actorId, row, reason, restock, `order-system-cancel:${orderId}`);
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
    });
    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'order.cancelled_by_system',
        entityType: 'Order',
        entityId: orderId,
        reason,
        before: { status: row.status },
        after: { status: 'CANCELLED' }
      },
      tx
    );
    await this.notifyStatus(tx, row, 'CANCELLED');

    return true;
  }

  /**
   * Chegada da remessa: pedido de retirada fica "pronto para retirada"; o de entrega em casa
   * vai para separação e o comprador é avisado de que a entrega vem a seguir (DT-075).
   */
  async markReadyInTx(tx: PrismaTx, actorId: string, orderId: string): Promise<boolean> {
    await lockRow(tx, 'order', orderId);
    const row = await this.reader.load(tx, orderId);

    if (row.status !== 'PAID' && row.status !== 'PROCESSING') {
      return false;
    }

    if (row.fulfillment === 'DELIVERY') {
      if (row.status === 'PROCESSING') {
        return false;
      }

      await tx.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });
      await this.audit.record(
        {
          actorUserId: actorId,
          action: 'order.status.changed',
          entityType: 'Order',
          entityId: orderId,
          before: { status: row.status },
          after: { status: 'PROCESSING' }
        },
        tx
      );

      await this.guestMessages.enqueue(
        tx,
        row,
        'arrived-delivery',
        `Pedido ${row.orderNumber}: encomenda chegou`,
        'Sua encomenda chegou e está em separação para a entrega no seu endereço.'
      );

      if (row.customerUserId) {
        await this.notifications.notify(
          {
            userId: row.customerUserId,
            type: 'order.status',
            title: `Pedido ${row.orderNumber}: encomenda chegou`,
            message: 'Sua encomenda chegou e está em separação para a entrega no seu endereço.',
            link: `/minha-conta/pedidos/${row.id}`,
            deduplicationKey: `order-status:${row.id}:arrived-delivery`
          },
          tx
        );
      }

      return true;
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'READY_FOR_PICKUP', readyForPickupAt: new Date() }
    });
    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'order.status.changed',
        entityType: 'Order',
        entityId: orderId,
        before: { status: row.status },
        after: { status: 'READY_FOR_PICKUP' }
      },
      tx
    );

    return true;
  }

  /** Retirada rastreável: registra itens retirados e entrega o pedido (RN-REM-006). */
  async markPickedUpInTx(
    tx: PrismaTx,
    actorId: string,
    orderId: string,
    note: string | null
  ): Promise<void> {
    await lockRow(tx, 'order', orderId);
    const row = await this.reader.load(tx, orderId);

    if (row.status !== 'READY_FOR_PICKUP') {
      throw AppError.conflict('NOT_READY', 'O pedido não está pronto para retirada.');
    }

    const now = new Date();

    await tx.orderItem.updateMany({
      where: { orderId, pickedUpAt: null },
      data: { pickedUpAt: now }
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED', deliveredAt: now }
    });
    await this.audit.record(
      {
        actorUserId: actorId,
        action: 'order.picked_up',
        entityType: 'Order',
        entityId: orderId,
        reason: note,
        before: { status: row.status },
        after: { status: 'DELIVERED' }
      },
      tx
    );
    await this.notifyStatus(tx, row, 'DELIVERED');
  }

  async cancelByBuyer(
    owner: { userId: string } | { orderNumber: string; code: string },
    orderId?: string
  ): Promise<OrderView> {
    const found = await this.prisma.order.findFirst({
      where:
        'userId' in owner
          ? { id: orderId ?? '', customerUserId: owner.userId }
          : {
              orderNumber: owner.orderNumber.trim().toUpperCase(),
              guestAccessTokenHash: guestCodeHash(owner.code)
            },
      select: { id: true }
    });

    if (found === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    const reason = 'Cancelado pelo comprador antes do pagamento';

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', found.id);
      const row = await this.reader.load(tx, found.id);

      if (row.status !== 'AWAITING_PAYMENT' && row.status !== 'CREATED') {
        throw AppError.conflict(
          'ORDER_NOT_CANCELLABLE',
          'Pedido pago não é cancelado por aqui: use "Desistir da compra" (até 7 dias depois de receber).'
        );
      }

      if (row.payments.some((p) => p.status === 'PENDING' || p.status === 'CONFIRMED')) {
        throw AppError.conflict(
          'PAYMENT_IN_REVIEW',
          'Há um pagamento em análise neste pedido. Fale com a diretoria para cancelar.'
        );
      }

      await this.unwind(tx, null, row, reason, false, `order-buyer-cancel:${row.id}`);
      await tx.order.update({
        where: { id: row.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
      });
      await this.audit.record(
        {
          actorUserId: 'userId' in owner ? owner.userId : null,
          action: 'order.cancelled_by_buyer',
          entityType: 'Order',
          entityId: row.id,
          reason,
          before: { status: row.status },
          after: { status: 'CANCELLED' }
        },
        tx
      );
    });

    this.site.changed(['store']);

    return this.reader.toView(await this.reader.load(this.prisma, found.id), undefined, true);
  }

  /** Cancela pedidos aguardando pagamento com reserva vencida e sem comprovante (PEN-027). */
  async expireStale(now: Date = new Date()): Promise<number> {
    const stale = await this.prisma.order.findMany({
      where: {
        status: 'AWAITING_PAYMENT',
        reservationExpiresAt: { lt: now },
        payments: { none: { status: 'PENDING' } }
      },
      select: { id: true },
      take: 100
    });

    for (const { id } of stale) {
      await this.prisma.$transaction(async (tx) => {
        await lockRow(tx, 'order', id);
        const row = await this.reader.load(tx, id);

        if (row.status !== 'AWAITING_PAYMENT') {
          return;
        }

        await this.unwind(
          tx,
          null,
          row,
          'Reserva expirada sem pagamento',
          false,
          `order-expired:${id}`
        );
        await tx.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancellationReason: 'Reserva expirada sem pagamento'
          }
        });
        await this.audit.record(
          {
            actorUserId: null,
            action: 'order.expired',
            entityType: 'Order',
            entityId: id,
            after: { status: 'CANCELLED' }
          },
          tx
        );
        await this.notifyStatus(tx, row, 'CANCELLED');
      });
    }

    return stale.length;
  }
}
