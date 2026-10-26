import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { OrderStatus, Prisma, SalesCampaignStatus } from '@prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, optionalCivil } from '../../../common/domain/civil-date';
import {
  DEFAULT_CURRENCY,
  type Money,
  type MoneyView,
  moneyView
} from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { SiteRevalidateService } from '../../../common/http/site-revalidate.interceptor';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { lockRow } from '../../finance/application/ledger.service';
import { mediaUrl } from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { slugify } from '../../sports/domain/sports-rules';
import { OrdersService } from '../../store/application/orders.service';
import {
  assertWindow,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TRANSITIONS,
  canOpen,
  type ConsolidationLine,
  consolidate,
  isEditable,
  minimumReached
} from '../domain/campaign-rules';
import { toCsv } from '../../../common/util/csv';

export interface CampaignProductView {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly productSlug: string;
  readonly image: string | null;
  readonly campaignPrice: MoneyView | null;
  readonly minimumQuantity: number | null;
  readonly maximumQuantity: number | null;
  readonly soldQuantity: number;
  readonly isActive: boolean;
}

export interface CampaignView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: SalesCampaignStatus;
  readonly salesStartAt: string;
  readonly salesEndAt: string;
  readonly minimumQuantity: number | null;
  readonly maximumQuantity: number | null;
  readonly paidQuantity: number;
  readonly reservedQuantity: number;
  readonly supplierOrderedOn: string | null;
  readonly expectedProductionOn: string | null;
  readonly expectedArrivalOn: string | null;
  readonly receivedOn: string | null;
  readonly pickupStartsOn: string | null;
  readonly pickupEndsOn: string | null;
  readonly refundPolicy: string | null;
  readonly cancellationReason: string | null;
  readonly supplier: { id: string; name: string } | null;
  readonly products: CampaignProductView[];
}

export interface CampaignInput {
  readonly name: string;
  readonly description?: string | null;
  readonly salesStartAt: string;
  readonly salesEndAt: string;
  readonly minimumQuantity?: number | null;
  readonly maximumQuantity?: number | null;
  readonly expectedArrivalOn?: string | null;
  readonly refundPolicy?: string | null;
  readonly supplierPartnerId?: string | null;
}

export interface CampaignReport {
  readonly campaign: { id: string; name: string; status: SalesCampaignStatus };
  readonly generatedAt: string;
  readonly lines: ConsolidationLine[];
  readonly totalQuantity: number;
  readonly orders: {
    orderNumber: string;
    customerName: string;
    customerPhone: string | null;
    status: OrderStatus;
    items: string;
    pickedUp: boolean;
  }[];
}

const ACTIVE_ORDER: OrderStatus[] = [
  'AWAITING_PAYMENT',
  'PAID',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'DELIVERED'
];
const PAID_ORDER: OrderStatus[] = ['PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'DELIVERED'];

const CAMPAIGN_INCLUDE = {
  supplierPartner: { select: { id: true, displayName: true } },
  products: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        include: {
          images: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }], take: 1 }
        }
      },
      orderItems: {
        where: { order: { status: { in: ACTIVE_ORDER } } },
        select: { quantity: true, order: { select: { status: true } } }
      }
    }
  }
} satisfies Prisma.SalesCampaignInclude;

type CampaignRow = Prisma.SalesCampaignGetPayload<{ include: typeof CAMPAIGN_INCLUDE }>;

function civilOrNull(value: string | null | undefined): Date | null {
  return value ? civilToDate(value) : null;
}

/** Remessas/campanhas (RF-035, RF-036, RF-044, RCF-009, DT-032). */
@Injectable()
export class CampaignsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailSender,
    private readonly jobs: JobScheduler,
    private readonly site: SiteRevalidateService
  ) {}

  onModuleInit(): void {
    this.jobs.every('store.campaigns.close', 10 * 60_000, async () => {
      if ((await this.closeExpired()) > 0) {
        this.site.changed(['store']);
      }
    });
  }

  private toView(row: CampaignRow): CampaignView {
    const products = row.products.map((link) => {
      const sold = link.orderItems.reduce((total, item) => total + item.quantity, 0);
      const image = link.product.images[0];

      return {
        id: link.id,
        productId: link.productId,
        productName: link.product.name,
        productSlug: link.product.slug,
        image: image ? mediaUrl(image.mediaFileId) : null,
        campaignPrice: link.campaignPrice ? moneyView(link.campaignPrice, row.currency) : null,
        minimumQuantity: link.minimumQuantity,
        maximumQuantity: link.maximumQuantity,
        soldQuantity: sold,
        isActive: link.isActive
      };
    });
    const items = row.products.flatMap((link) => link.orderItems);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      salesStartAt: row.salesStartAt.toISOString(),
      salesEndAt: row.salesEndAt.toISOString(),
      minimumQuantity: row.minimumQuantity,
      maximumQuantity: row.maximumQuantity,
      paidQuantity: items
        .filter((i) => PAID_ORDER.includes(i.order.status))
        .reduce((t, i) => t + i.quantity, 0),
      reservedQuantity: items
        .filter((i) => i.order.status === 'AWAITING_PAYMENT')
        .reduce((t, i) => t + i.quantity, 0),
      supplierOrderedOn: optionalCivil(row.supplierOrderedOn),
      expectedProductionOn: optionalCivil(row.expectedProductionOn),
      expectedArrivalOn: optionalCivil(row.expectedArrivalOn),
      receivedOn: optionalCivil(row.receivedOn),
      pickupStartsOn: optionalCivil(row.pickupStartsOn),
      pickupEndsOn: optionalCivil(row.pickupEndsOn),
      refundPolicy: row.refundPolicy,
      cancellationReason: row.cancellationReason,
      supplier: row.supplierPartner
        ? { id: row.supplierPartner.id, name: row.supplierPartner.displayName }
        : null,
      products
    };
  }

  async list(publicOnly: boolean): Promise<CampaignView[]> {
    const rows = await this.prisma.salesCampaign.findMany({
      where: {
        deletedAt: null,
        ...(publicOnly ? { status: 'OPEN', salesEndAt: { gt: new Date() } } : {})
      },
      include: CAMPAIGN_INCLUDE,
      orderBy: { salesStartAt: 'desc' }
    });

    return rows.map((row) => this.toView(row));
  }

  async get(idOrSlug: string, publicOnly = false): Promise<CampaignView> {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const row = await this.prisma.salesCampaign.findFirst({
      where: {
        deletedAt: null,
        ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }),
        ...(publicOnly
          ? {
              status: {
                in: ['OPEN', 'CLOSED', 'ORDERED', 'IN_PRODUCTION', 'RECEIVED', 'READY_FOR_PICKUP']
              }
            }
          : {})
      },
      include: CAMPAIGN_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Remessa não encontrada.');
    }

    return this.toView(row);
  }

  async create(actor: Principal, input: CampaignInput, meta: RequestMeta): Promise<CampaignView> {
    const window = {
      salesStartAt: new Date(input.salesStartAt),
      salesEndAt: new Date(input.salesEndAt)
    };
    const invalid = assertWindow(window);

    if (invalid) {
      throw AppError.validation('INVALID_WINDOW', invalid);
    }

    const base = slugify(input.name) || 'remessa';
    let slug = base;

    for (
      let n = 2;
      await this.prisma.salesCampaign.findUnique({ where: { slug }, select: { id: true } });
      n += 1
    ) {
      slug = `${base}-${n}`;
    }

    const row = await this.prisma.salesCampaign.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        ...window,
        currency: DEFAULT_CURRENCY,
        minimumQuantity: input.minimumQuantity ?? null,
        maximumQuantity: input.maximumQuantity ?? null,
        expectedArrivalOn: civilOrNull(input.expectedArrivalOn),
        refundPolicy: input.refundPolicy ?? null,
        supplierPartnerId: input.supplierPartnerId ?? null,
        createdById: actor.userId
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'campaign.created',
      entityType: 'SalesCampaign',
      entityId: row.id,
      after: { name: row.name },
      meta
    });

    return this.get(row.id);
  }

  async update(
    actor: Principal,
    id: string,
    input: Partial<CampaignInput>,
    meta: RequestMeta
  ): Promise<CampaignView> {
    const current = await this.prisma.salesCampaign.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Remessa não encontrada.');
    }

    if (
      !isEditable(current.status) &&
      (input.salesStartAt ||
        input.salesEndAt ||
        input.minimumQuantity !== undefined ||
        input.maximumQuantity !== undefined)
    ) {
      throw AppError.conflict(
        'CAMPAIGN_LOCKED',
        'Após a encomenda, período e quantidades não podem ser alterados.'
      );
    }

    const window = {
      salesStartAt: input.salesStartAt ? new Date(input.salesStartAt) : current.salesStartAt,
      salesEndAt: input.salesEndAt ? new Date(input.salesEndAt) : current.salesEndAt
    };
    const invalid = assertWindow(window);

    if (invalid) {
      throw AppError.validation('INVALID_WINDOW', invalid);
    }

    await this.prisma.salesCampaign.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...window,
        ...(input.minimumQuantity === undefined ? {} : { minimumQuantity: input.minimumQuantity }),
        ...(input.maximumQuantity === undefined ? {} : { maximumQuantity: input.maximumQuantity }),
        ...(input.expectedArrivalOn === undefined
          ? {}
          : { expectedArrivalOn: civilOrNull(input.expectedArrivalOn) }),
        ...(input.refundPolicy === undefined ? {} : { refundPolicy: input.refundPolicy }),
        ...(input.supplierPartnerId === undefined
          ? {}
          : { supplierPartnerId: input.supplierPartnerId })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'campaign.updated',
      entityType: 'SalesCampaign',
      entityId: id,
      before: {
        salesEndAt: current.salesEndAt.toISOString(),
        minimumQuantity: current.minimumQuantity,
        maximumQuantity: current.maximumQuantity
      },
      after: input as Record<string, unknown>,
      meta
    });

    return this.get(id);
  }

  async setProduct(
    actor: Principal,
    id: string,
    input: {
      productId: string;
      campaignPrice?: Money | null;
      minimumQuantity?: number | null;
      maximumQuantity?: number | null;
      isActive?: boolean;
    },
    meta: RequestMeta
  ): Promise<CampaignView> {
    const campaign = await this.prisma.salesCampaign.findFirst({ where: { id, deletedAt: null } });

    if (campaign === null) {
      throw AppError.notFound('Remessa não encontrada.');
    }

    if (!isEditable(campaign.status)) {
      throw AppError.conflict(
        'CAMPAIGN_LOCKED',
        'Os produtos não podem mudar após a encomenda ao fornecedor.'
      );
    }

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, deletedAt: null }
    });

    if (product === null || product.fulfillmentType !== 'CAMPAIGN') {
      throw AppError.validation(
        'NOT_CAMPAIGN_PRODUCT',
        'Somente produtos com modo de venda "Remessa" podem ser vinculados.'
      );
    }

    const other = await this.prisma.salesCampaignProduct.findFirst({
      where: {
        productId: input.productId,
        isActive: true,
        deletedAt: null,
        salesCampaignId: { not: id },
        salesCampaign: { status: { in: ['DRAFT', 'SCHEDULED', 'OPEN'] } }
      }
    });

    if (other) {
      throw AppError.conflict(
        'PRODUCT_IN_OTHER_CAMPAIGN',
        'Este produto já está em outra remessa ativa.'
      );
    }

    await this.prisma.salesCampaignProduct.upsert({
      where: { salesCampaignId_productId: { salesCampaignId: id, productId: input.productId } },
      create: {
        salesCampaignId: id,
        productId: input.productId,
        campaignPrice: input.campaignPrice ?? null,
        minimumQuantity: input.minimumQuantity ?? null,
        maximumQuantity: input.maximumQuantity ?? null,
        isActive: input.isActive ?? true
      },
      update: {
        deletedAt: null,
        ...(input.campaignPrice === undefined ? {} : { campaignPrice: input.campaignPrice }),
        ...(input.minimumQuantity === undefined ? {} : { minimumQuantity: input.minimumQuantity }),
        ...(input.maximumQuantity === undefined ? {} : { maximumQuantity: input.maximumQuantity }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'campaign.product.set',
      entityType: 'SalesCampaign',
      entityId: id,
      after: {
        productId: input.productId,
        campaignPrice: input.campaignPrice?.toFixed(2) ?? null,
        isActive: input.isActive ?? true
      },
      meta
    });

    return this.get(id);
  }

  private async paidQuantity(campaignId: string): Promise<number> {
    const aggregate = await this.prisma.orderItem.aggregate({
      where: {
        salesCampaignProduct: { salesCampaignId: campaignId },
        order: { status: { in: PAID_ORDER } }
      },
      _sum: { quantity: true }
    });

    return aggregate._sum.quantity ?? 0;
  }

  private async campaignOrderIds(campaignId: string, statuses: OrderStatus[]): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: statuses },
        items: { some: { salesCampaignProduct: { salesCampaignId: campaignId } } }
      },
      select: { id: true }
    });

    return orders.map((order) => order.id);
  }

  /**
   * Mudança de etapa (RF-036). Encomendar exige mínimo pago e cancela pedidos sem
   * pagamento; cancelar estorna todos os pedidos; recebimento notifica compradores.
   */
  async changeStatus(
    actor: Principal,
    id: string,
    status: SalesCampaignStatus,
    input: {
      reason?: string;
      salesEndAt?: string;
      date?: string;
      pickupStartsOn?: string;
      pickupEndsOn?: string;
      pickupInstructions?: string;
    },
    meta: RequestMeta
  ): Promise<CampaignView> {
    const current = await this.prisma.salesCampaign.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Remessa não encontrada.');
    }

    assertTransition(CAMPAIGN_TRANSITIONS, current.status, status, CAMPAIGN_STATUS_LABELS);
    const now = new Date();
    const data: Prisma.SalesCampaignUpdateInput = { status };

    if (status === 'OPEN') {
      const salesEndAt = input.salesEndAt ? new Date(input.salesEndAt) : current.salesEndAt;

      if (!canOpen({ salesStartAt: current.salesStartAt, salesEndAt }, now)) {
        throw AppError.validation(
          'EXTEND_DEADLINE',
          'Informe um novo encerramento no futuro para reabrir as vendas.'
        );
      }

      const products = await this.prisma.salesCampaignProduct.count({
        where: { salesCampaignId: id, isActive: true, deletedAt: null }
      });

      if (products === 0) {
        throw AppError.validation(
          'NO_PRODUCTS',
          'Vincule ao menos um produto antes de abrir as vendas.'
        );
      }

      data.salesEndAt = salesEndAt;
    }

    if (status === 'CANCELLED') {
      if (!input.reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo do cancelamento.');
      }

      if (!actor.permissions.has(PERMISSIONS.paymentsCorrect)) {
        throw AppError.forbidden('Cancelar remessa exige permissão de estorno de pagamentos.');
      }

      data.cancellationReason = input.reason;
    }

    if (status === 'ORDERED') {
      const pendingProofs = await this.prisma.order.count({
        where: {
          status: 'AWAITING_PAYMENT',
          payments: { some: { status: 'PENDING' } },
          items: { some: { salesCampaignProduct: { salesCampaignId: id } } }
        }
      });

      if (pendingProofs > 0) {
        throw AppError.conflict(
          'PENDING_PROOFS',
          `Há ${pendingProofs} comprovante(s) aguardando confirmação. Confirme ou recuse antes de encomendar.`
        );
      }

      const paid = await this.paidQuantity(id);

      if (!minimumReached({ minimumQuantity: current.minimumQuantity, paidQuantity: paid })) {
        throw AppError.conflict(
          'MINIMUM_NOT_REACHED',
          `Mínimo de ${current.minimumQuantity} unidade(s) pagas não atingido (${paid}). Estenda o prazo ou cancele a remessa.`
        );
      }

      data.supplierOrderedOn = civilToDate(input.date ?? now.toISOString().slice(0, 10));
    }

    if (status === 'IN_PRODUCTION' && input.date) {
      data.expectedProductionOn = civilToDate(input.date);
    }

    if (status === 'RECEIVED') {
      data.receivedOn = civilToDate(input.date ?? now.toISOString().slice(0, 10));
    }

    if (status === 'READY_FOR_PICKUP') {
      if (!input.pickupStartsOn) {
        throw AppError.validation(
          'PICKUP_REQUIRED',
          'Informe a partir de quando a retirada está disponível.'
        );
      }

      data.pickupStartsOn = civilToDate(input.pickupStartsOn);
      data.pickupEndsOn = civilOrNull(input.pickupEndsOn);
    }

    const affected: string[] = [];

    await this.prisma.$transaction(
      async (tx) => {
        await lockRow(tx, 'campaign', id);

        if (status === 'ORDERED') {
          for (const orderId of await this.campaignOrderIds(id, ['AWAITING_PAYMENT', 'CREATED'])) {
            if (
              await this.orders.systemCancelInTx(
                tx,
                actor.userId,
                orderId,
                'Remessa encomendada ao fornecedor sem pagamento deste pedido'
              )
            ) {
              affected.push(orderId);
            }
          }
        }

        if (status === 'CANCELLED') {
          for (const orderId of await this.campaignOrderIds(id, ACTIVE_ORDER)) {
            if (
              await this.orders.systemCancelInTx(
                tx,
                actor.userId,
                orderId,
                `Remessa cancelada: ${input.reason as string}`
              )
            ) {
              affected.push(orderId);
            }
          }
        }

        if (status === 'READY_FOR_PICKUP') {
          for (const orderId of await this.campaignOrderIds(id, ['PAID', 'PROCESSING'])) {
            if (await this.orders.markReadyInTx(tx, actor.userId, orderId)) {
              affected.push(orderId);
            }
          }
        }

        await tx.salesCampaign.update({ where: { id }, data });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'campaign.status.changed',
            entityType: 'SalesCampaign',
            entityId: id,
            reason: input.reason ?? null,
            before: { status: current.status },
            after: { status, affectedOrders: affected.length },
            meta
          },
          tx
        );
      },
      { timeout: 60_000 }
    );

    if (status === 'READY_FOR_PICKUP') {
      await this.notifyArrival(id, input.pickupInstructions ?? null);
    }

    return this.get(id);
  }

  /**
   * RF-044: avisa somente compradores com pedido pago da remessa, uma única vez por
   * item (`arrival_notified_at`), com local e prazo vigentes.
   */
  async notifyArrival(id: string, instructions: string | null): Promise<number> {
    const campaign = await this.prisma.salesCampaign.findUniqueOrThrow({ where: { id } });
    const items = await this.prisma.orderItem.findMany({
      where: {
        arrivalNotifiedAt: null,
        salesCampaignProduct: { salesCampaignId: id },
        order: { status: { in: ['READY_FOR_PICKUP'] } }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerUserId: true,
            customerEmail: true,
            customerName: true
          }
        }
      }
    });
    const settings = await this.prisma.teamSettings.findFirst({
      select: { pickupInstructions: true }
    });
    const where =
      instructions ?? settings?.pickupInstructions ?? 'Combine a retirada com a diretoria.';
    const period = `${optionalCivil(campaign.pickupStartsOn)?.split('-').reverse().join('/') ?? ''}${
      campaign.pickupEndsOn
        ? ` até ${optionalCivil(campaign.pickupEndsOn)?.split('-').reverse().join('/')}`
        : ''
    }`;
    const orders = new Map(items.map((item) => [item.order.id, item.order]));

    for (const order of orders.values()) {
      const claimed = await this.prisma.orderItem.updateMany({
        where: {
          orderId: order.id,
          arrivalNotifiedAt: null,
          salesCampaignProduct: { salesCampaignId: id }
        },
        data: { arrivalNotifiedAt: new Date() }
      });

      if (claimed.count === 0) {
        continue;
      }

      const message = `A remessa "${campaign.name}" chegou! Retire o pedido ${order.orderNumber} a partir de ${period}. ${where}`;

      if (order.customerUserId) {
        await this.notifications.notify({
          userId: order.customerUserId,
          type: 'campaign.arrived',
          title: 'Sua encomenda chegou',
          message,
          link: `/minha-conta/pedidos/${order.id}`,
          deduplicationKey: `campaign-arrived:${id}:${order.id}`
        });
      }

      // Quem tem conta recebe pelo aviso, no canal que escolheu (DT-048); o e-mail direto
      // fica para compras sem conta.
      if (order.customerEmail && !order.customerUserId) {
        await this.mail
          .send({
            to: order.customerEmail,
            subject: `Pedido ${order.orderNumber} pronto para retirada — Fênix Vôlei`,
            text: `Olá, ${order.customerName}.\n\n${message}`
          })
          .catch(() => undefined);
      }
    }

    return orders.size;
  }

  async pickup(
    actor: Principal,
    id: string,
    orderId: string,
    note: string | null,
    meta: RequestMeta
  ): Promise<CampaignReport> {
    await this.prisma.$transaction(async (tx) => {
      const belongs = await tx.orderItem.count({
        where: { orderId, salesCampaignProduct: { salesCampaignId: id } }
      });

      if (belongs === 0) {
        throw AppError.notFound('Pedido não pertence a esta remessa.');
      }

      await this.orders.markPickedUpInTx(tx, actor.userId, orderId, note);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'campaign.pickup',
          entityType: 'SalesCampaign',
          entityId: id,
          after: { orderId },
          reason: note,
          meta
        },
        tx
      );
    });

    return this.report(id);
  }

  /** RN-REM-003: consolidação somente de pedidos pagos (base para a malharia). */
  async report(id: string): Promise<CampaignReport> {
    const campaign = await this.prisma.salesCampaign.findFirst({ where: { id, deletedAt: null } });

    if (campaign === null) {
      throw AppError.notFound('Remessa não encontrada.');
    }

    const items = await this.prisma.orderItem.findMany({
      where: {
        salesCampaignProduct: { salesCampaignId: id },
        order: { status: { in: PAID_ORDER } }
      },
      include: {
        productVariant: { select: { name: true } },
        order: {
          select: { orderNumber: true, customerName: true, customerPhone: true, status: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    const lines = consolidate(
      items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        variantName: item.productVariant.name,
        sku: item.sku,
        quantity: item.quantity
      }))
    );
    const byOrder = new Map<string, CampaignReport['orders'][number]>();

    for (const item of items) {
      const key = item.order.orderNumber;
      const entry = byOrder.get(key);
      const text = `${item.quantity}× ${item.productName} (${item.productVariant.name})`;

      byOrder.set(key, {
        orderNumber: key,
        customerName: item.order.customerName,
        customerPhone: item.order.customerPhone,
        status: item.order.status,
        items: entry ? `${entry.items}; ${text}` : text,
        pickedUp: item.order.status === 'DELIVERED'
      });
    }

    return {
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
      generatedAt: new Date().toISOString(),
      lines,
      totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
      orders: [...byOrder.values()]
    };
  }

  async reportCsv(
    id: string,
    kind: 'supplier' | 'pickup'
  ): Promise<{ fileName: string; content: string }> {
    const report = await this.report(id);
    const safeName = slugify(report.campaign.name) || 'remessa';

    if (kind === 'supplier') {
      return {
        fileName: `${safeName}-malharia.csv`,
        content: toCsv(
          ['Produto', 'Variação', 'SKU', 'Quantidade'],
          report.lines.map((l) => [l.productName, l.variantName, l.sku, l.quantity])
        )
      };
    }

    return {
      fileName: `${safeName}-retirada.csv`,
      content: toCsv(
        ['Pedido', 'Cliente', 'Telefone', 'Itens', 'Retirado'],
        report.orders.map((o) => [
          o.orderNumber,
          o.customerName,
          o.customerPhone ?? '',
          o.items,
          o.pickedUp ? 'sim' : 'não'
        ])
      )
    };
  }

  /** Encerra vendas de remessas cujo prazo passou (venda fora do período já é bloqueada no carrinho). */
  async closeExpired(now: Date = new Date()): Promise<number> {
    const expired = await this.prisma.salesCampaign.findMany({
      where: { status: 'OPEN', salesEndAt: { lt: now } },
      select: { id: true }
    });

    for (const { id } of expired) {
      const result = await this.prisma.salesCampaign.updateMany({
        where: { id, status: 'OPEN' },
        data: { status: 'CLOSED' }
      });

      if (result.count === 1) {
        await this.audit.record({
          actorUserId: null,
          action: 'campaign.closed_by_deadline',
          entityType: 'SalesCampaign',
          entityId: id,
          after: { status: 'CLOSED' }
        });
      }
    }

    return expired.length;
  }
}
