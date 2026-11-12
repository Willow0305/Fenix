import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { money, type Money, sum, ZERO } from '../../../common/domain/money';
import { startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import { PaymentsService } from '../../finance/application/payments.service';
import { SYSTEM_CATEGORY } from '../../finance/domain/finance-catalog';
import {
  DOCUMENT_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { ORDER_STATUS_LABELS } from '../domain/store-rules';
import { InventoryService } from './inventory.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { CardsService } from '../../member-cards/application/cards.service';
import { GuestMessagesService } from './guest-messages.service';
import { OrderView, PixReceipt, OrderRow } from './order-view';
import { OrderReader } from './order-view';

/**
 * Pagamento de pedidos (RF-017, DT-031, DT-071): PIX automático, pagamento registrado pela
 * diretoria, comprovante do comprador e confirmação. Pagamento confirmado converte a reserva
 * em saída de estoque e lança no Caixa.
 */
@Injectable()
export class OrderPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly cards: CardsService,
    private readonly guestMessages: GuestMessagesService,
    private readonly reader: OrderReader
  ) {}

  /**
   * Depois do pagamento: afiliações viram carteirinhas (DT-068). Pedido só de afiliação já
   * está entregue (não há o que retirar); a entrega é a ativação.
   */
  async afterPaidInTx(tx: PrismaTx, orderId: string): Promise<void> {
    await this.cards.activateAffiliationsInTx(tx, orderId);

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { product: { select: { fulfillmentType: true } } }
    });

    if (items.length > 0 && items.every((item) => item.product.fulfillmentType === 'MEMBERSHIP')) {
      await tx.order.update({
        where: { id: orderId },
        // Afiliação: a entrega é a ativação, comprovada pelo sistema (DT-070).
        data: { status: 'DELIVERED', deliveredAt: new Date(), deliveryConfirmedAt: new Date() }
      });
    }
  }

  private async markPaid(tx: PrismaTx, actorId: string | null, row: OrderRow): Promise<void> {
    await tx.order.update({ where: { id: row.id }, data: { status: 'PAID', paidAt: new Date() } });

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
          reason: `Pagamento ${row.orderNumber}`,
          actorId
        });
        await this.inventory.record(tx, {
          variantId: item.productVariantId,
          type: 'STOCK_OUT',
          quantity: outstanding,
          orderItemId: item.id,
          reason: `Venda ${row.orderNumber}`,
          actorId
        });
      }
    }

    await this.afterPaidInTx(tx, row.id);
    await this.guestMessages.enqueue(
      tx,
      row,
      'paid',
      `Pedido ${row.orderNumber}: pagamento confirmado`,
      `O pagamento do pedido ${row.orderNumber} foi confirmado. Avisamos quando ele estiver pronto.`
    );

    if (row.customerUserId) {
      await this.notifications.notify(
        {
          userId: row.customerUserId,
          type: 'order.paid',
          title: 'Pagamento confirmado',
          message: `O pagamento do pedido ${row.orderNumber} foi confirmado.`,
          link: `/minha-conta/pedidos/${row.id}`,
          deduplicationKey: `order-paid:${row.id}`
        },
        tx
      );
    }
  }

  private async confirmInTx(
    tx: PrismaTx,
    actorId: string | null,
    row: OrderRow,
    paymentId: string,
    accountId: string
  ): Promise<void> {
    const feePaymentId = await this.splitDeliveryFee(tx, actorId, row, paymentId);

    await this.payments.confirmInTx(tx, actorId, paymentId, {
      accountId,
      categoryCode: row.items.some((item) => item.partnerId)
        ? SYSTEM_CATEGORY.partnerSales
        : SYSTEM_CATEGORY.storeSales,
      origin: 'ORDER',
      description: `Pedido ${row.orderNumber} — ${row.customerName}`
    });

    if (feePaymentId) {
      await this.payments.confirmInTx(tx, actorId, feePaymentId, {
        accountId,
        categoryCode: SYSTEM_CATEGORY.deliveryFees,
        origin: 'ORDER',
        description: `Entrega do pedido ${row.orderNumber} — ${row.customerName}`
      });
    }

    const refreshed = await this.reader.load(tx, row.id);
    const confirmed = sum(
      refreshed.payments.filter((p) => p.status === 'CONFIRMED').map((p) => p.amount)
    );

    if (
      confirmed.greaterThanOrEqualTo(refreshed.totalAmount) &&
      (refreshed.status === 'AWAITING_PAYMENT' || refreshed.status === 'CREATED')
    ) {
      await this.markPaid(tx, actorId, refreshed);
    }
  }

  /**
   * Receita "Entregas" (DT-075): o pagamento que quita um pedido com entrega é dividido e a
   * taxa vira um pagamento irmão. Pagamentos parciais fora desse caso ficam como venda.
   */
  private async splitDeliveryFee(
    tx: PrismaTx,
    actorId: string | null,
    row: OrderRow,
    paymentId: string
  ): Promise<string | null> {
    const fee = money(row.deliveryFeeAmount);

    if (row.fulfillment !== 'DELIVERY' || fee.lte(0) || row.payments.some((p) => p.isDeliveryFee)) {
      return null;
    }

    const payment = row.payments.find((p) => p.id === paymentId);
    const confirmed = sum(
      row.payments.filter((p) => p.status === 'CONFIRMED').map((p) => p.amount)
    );

    if (
      !payment ||
      payment.status !== 'PENDING' ||
      money(payment.amount).lte(fee) ||
      confirmed.plus(payment.amount).lt(row.totalAmount)
    ) {
      return null;
    }

    return this.payments.splitPendingInTx(tx, actorId, paymentId, fee, {
      isDeliveryFee: true,
      notes: 'Taxa de entrega'
    });
  }

  private remaining(row: OrderRow): Money {
    const used = sum(
      row.payments
        .filter((p) => p.status === 'CONFIRMED' || p.status === 'PENDING')
        .map((p) => p.amount)
    );
    const left = row.totalAmount.minus(used);

    return left.lessThan(0) ? ZERO : left;
  }

  /**
   * Baixa automática do PIX do intermediário (DT-071): cria o pagamento e confirma no Caixa,
   * sem pessoa da diretoria. Só baixa se o pedido aguardava pagamento e o valor é o saldo;
   * caso contrário devolve o motivo e nada muda (a cobrança vai para revisão).
   */
  async receivePixInTx(
    tx: PrismaTx,
    orderId: string,
    input: {
      amount: Money;
      paidAt: Date;
      accountId: string;
      provider: string;
      reference: string;
      /** Cartão pelo site (DT-079): método do Caixa e observação; padrão é o PIX. */
      methodCode?: 'pix' | 'cartao-credito' | 'cartao-debito';
      notes?: string;
    }
  ): Promise<PixReceipt> {
    await lockRow(tx, 'order', orderId);
    const row = await this.reader.load(tx, orderId);

    if (row.status !== 'AWAITING_PAYMENT' && row.status !== 'CREATED') {
      return {
        ok: false,
        reason: `Pedido ${row.orderNumber} não aguardava pagamento (${ORDER_STATUS_LABELS[row.status]}).`
      };
    }

    const remaining = this.remaining(row);

    if (!money(input.amount).equals(remaining)) {
      return {
        ok: false,
        reason: `Valor pago (R$ ${money(input.amount).toFixed(2)}) diferente do saldo do pedido (R$ ${remaining.toFixed(2)}).`
      };
    }

    const method = await tx.paymentMethod.findUniqueOrThrow({
      where: { code: input.methodCode ?? 'pix' },
      select: { id: true }
    });
    const payment = await this.payments.createInTx(tx, null, {
      paymentMethodId: method.id,
      amount: remaining,
      payerUserId: row.customerUserId,
      orderId,
      paidAt: input.paidAt,
      notes: input.notes ?? 'PIX automático',
      idempotencyKey: `${input.methodCode ? 'card' : 'pix'}:${input.provider}:${input.reference}`,
      provider: input.provider,
      externalReference: input.reference
    });

    if (!payment.replayed) {
      await this.confirmInTx(
        tx,
        null,
        await this.reader.load(tx, orderId),
        payment.id,
        input.accountId
      );
    }

    return { ok: true, paymentId: payment.id };
  }

  /** Pagamento manual pela diretoria; com conta e permissão, confirma e lança no Caixa (RF-029). */
  async recordPayment(
    actor: Principal,
    id: string,
    input: { paymentMethodId: string; paidOn: string; notes?: string; accountId?: string },
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<OrderView> {
    if (input.accountId && !actor.permissions.has(PERMISSIONS.paymentsConfirm)) {
      throw AppError.forbidden('Você não tem permissão para confirmar pagamentos.');
    }

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', id);
      const row = await this.reader.load(tx, id);

      if (row.status !== 'AWAITING_PAYMENT' && row.status !== 'CREATED') {
        throw AppError.conflict('ORDER_NOT_PAYABLE', 'Este pedido não está aguardando pagamento.');
      }

      const amount = this.remaining(row);

      if (amount.lessThanOrEqualTo(0)) {
        throw AppError.conflict(
          'ALREADY_COVERED',
          'O pedido já possui pagamento registrado em análise.'
        );
      }

      const payment = await this.payments.createInTx(tx, actor.userId, {
        paymentMethodId: input.paymentMethodId,
        amount,
        payerUserId: row.customerUserId,
        orderId: id,
        paidAt: startOfDayInZone(input.paidOn),
        notes: input.notes ?? null,
        idempotencyKey: `order-payment:${idempotencyKey}`
      });

      if (payment.replayed) {
        return;
      }

      if (input.accountId) {
        await this.confirmInTx(
          tx,
          actor.userId,
          await this.reader.load(tx, id),
          payment.id,
          input.accountId
        );
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.payment.recorded',
          entityType: 'Order',
          entityId: id,
          after: { paymentId: payment.id, amount: amount.toFixed(2) },
          meta
        },
        tx
      );
    });

    return this.reader.get(id);
  }

  async confirmPayment(
    actor: Principal,
    id: string,
    paymentId: string,
    accountId: string,
    meta: RequestMeta
  ): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', id);
      const row = await this.reader.load(tx, id);

      if (!row.payments.some((p) => p.id === paymentId)) {
        throw AppError.notFound('Pagamento não pertence a este pedido.');
      }

      if (row.status === 'CANCELLED' || row.status === 'REFUNDED') {
        throw AppError.conflict('ORDER_CLOSED', 'Pedido cancelado não recebe pagamentos.');
      }

      await this.confirmInTx(tx, actor.userId, row, paymentId, accountId);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'order.payment.confirmed',
          entityType: 'Order',
          entityId: id,
          after: { paymentId },
          meta
        },
        tx
      );
    });

    return this.reader.get(id);
  }

  /** Comprovante PIX do cliente (conta própria ou visitante com código). */
  async submitProof(
    order: { id: string; userId: string | null },
    input: { paidOn: string; notes?: string },
    file: IncomingFile | undefined,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<OrderView> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', order.id);
      const row = await this.reader.load(tx, order.id);

      if (row.status !== 'AWAITING_PAYMENT') {
        throw AppError.conflict('ORDER_NOT_PAYABLE', 'Este pedido não está aguardando pagamento.');
      }

      const amount = this.remaining(row);

      if (amount.lessThanOrEqualTo(0)) {
        throw AppError.conflict(
          'ALREADY_COVERED',
          'Já existe um comprovante em análise para este pedido.'
        );
      }

      const pix = await tx.paymentMethod.findUniqueOrThrow({
        where: { code: 'pix' },
        select: { id: true }
      });
      const actorId = order.userId ?? row.customerUserId ?? null;
      const payment = await this.payments.createInTx(tx, actorId, {
        paymentMethodId: pix.id,
        amount,
        payerUserId: row.customerUserId,
        orderId: row.id,
        paidAt: startOfDayInZone(input.paidOn),
        notes: input.notes ?? null,
        idempotencyKey: `order-proof:${idempotencyKey}`
      });

      if (payment.replayed) {
        return;
      }

      const stored = await this.media.store(
        file,
        { ...DOCUMENT_POLICY, kind: 'RECEIPT', classification: 'CONFIDENTIAL' },
        actorId,
        tx
      );

      await tx.financialTransactionAttachment.create({
        data: { paymentId: payment.id, mediaFileId: stored.id, type: 'RECEIPT' }
      });
      // Reserva não expira enquanto o comprovante está em análise.
      await tx.order.update({ where: { id: row.id }, data: { reservationExpiresAt: null } });
      await this.audit.record(
        {
          actorUserId: actorId,
          action: 'order.proof.submitted',
          entityType: 'Order',
          entityId: row.id,
          after: { paymentId: payment.id },
          meta
        },
        tx
      );
    });

    const view = await this.reader.get(order.id);

    await this.staffAlerts.alert(PERMISSIONS.ordersRead, {
      type: 'staff.order.proof',
      title: `Comprovante no pedido ${view.orderNumber}`,
      message: `${view.customerName} enviou o comprovante de pagamento. Confira e confirme.`,
      link: `/admin/pedidos/${order.id}`,
      key: `staff-order-proof:${order.id}:${idempotencyKey}`
    });

    return view;
  }

  async paymentAttachmentForOrder(orderId: string, paymentId: string, attachmentId: string) {
    const attachment = await this.prisma.financialTransactionAttachment.findFirst({
      where: { id: attachmentId, paymentId, deletedAt: null, payment: { orderId } },
      select: { mediaFileId: true }
    });

    if (attachment === null) {
      throw AppError.notFound('Comprovante não encontrado.');
    }

    return this.media.read(attachment.mediaFileId, undefined, true);
  }
}
