import { Injectable } from '@nestjs/common';
import type {
  DeliveryProofKind,
  OrderFulfillment,
  OrderPaymentChoice,
  OrderStatus,
  Prisma
} from '../../../generated/prisma/client';
import { type MoneyView, moneyView, sum, ZERO } from '../../../common/domain/money';
import { endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { AppConfig } from '../../../common/config/app-config';
import { PaymentsService, type PaymentView } from '../../finance/application/payments.service';
import { SettingsService } from '../../settings/application/settings.service';
import {
  type AddressInput,
  type DeliveryAddress,
  firstName,
  notReceivedDeadline
} from '../domain/delivery';
import { decryptField } from '../../../common/crypto/data-cipher';
import { beneficiariesOf } from '../domain/cart-details';

export interface OrderItemView {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  readonly variantName: string | null;
  readonly quantity: number;
  readonly unitPrice: MoneyView;
  /** Parte do desconto do cupom neste item (DT-045). */
  readonly discountAmount: MoneyView;
  readonly totalAmount: MoneyView;
  readonly campaign: { id: string; name: string; status: string } | null;
  readonly partnerId: string | null;
  readonly pickedUpAt: string | null;
  readonly arrivalNotifiedAt: string | null;
  /** Personalização travada na compra (DT-069): rótulo e valor. */
  readonly personalization: { label: string; value: string }[];
  /** Afiliação: nomes dos beneficiários (DT-068). */
  readonly beneficiaries: string[];
}

export interface OrderCardHolder {
  readonly name: string | null;
  /** Documento já mascarado (`***.456.789-**`). */
  readonly document: string | null;
  readonly brand: string | null;
  readonly lastFour: string | null;
}

export interface OrderView {
  readonly id: string;
  /** Só na consulta sem conta: chave para acompanhar o pedido ao vivo (DT-116). */
  readonly liveKey?: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly customerName: string;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly isGuest: boolean;
  /** Sem conta: pediu os avisos do pedido por WhatsApp (DT-096). */
  readonly guestWhatsappOptIn: boolean;
  readonly subtotalAmount: MoneyView;
  readonly discountAmount: MoneyView;
  /** Cupom usado; `released` quando o pedido foi cancelado e o uso, liberado. */
  readonly coupon: { code: string; released: boolean } | null;
  readonly totalAmount: MoneyView;
  readonly paidAmount: MoneyView;
  readonly pendingAmount: MoneyView;
  readonly notes: string | null;
  readonly items: OrderItemView[];
  readonly payments: PaymentView[];
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly readyForPickupAt: string | null;
  readonly deliveredAt: string | null;
  /** Entrega comprovada (DT-070): foto da diretoria ou "Recebi" do comprador. */
  readonly deliveryConfirmedAt: string | null;
  readonly receiptConfirmedAt: string | null;
  readonly hasDeliveryProof: boolean;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly reservationExpiresAt: string | null;
  /** Retirada ou entrega em casa (DT-075). */
  readonly fulfillment: OrderFulfillment;
  /** PIX ou cartão com a diretoria (DT-076). */
  readonly paymentChoice: OrderPaymentChoice;
  /**
   * Só na visão da diretoria (DT-100): titular do cartão pago pelo site, para conferir na
   * retirada ou entrega quando o nome não bate com o de quem comprou.
   */
  readonly cardHolder?: OrderCardHolder | null;
  readonly deliveryFee: MoneyView;
  /** Cópia do endereço da compra (só na entrega). */
  readonly deliveryAddress: DeliveryAddress | null;
  readonly outForDeliveryAt: string | null;
  /** Prova da entrega em casa (RN-ENT-006). */
  readonly deliveryProofKind: DeliveryProofKind | null;
  /** Quem está levando ou levou: só primeiro nome, veículo e placa (RN-ENT-005). */
  readonly courier: {
    firstName: string | null;
    vehicle: string | null;
    plate: string | null;
  } | null;
  /** Código de 4 dígitos: só para o comprador, enquanto o pedido está a caminho. */
  readonly deliveryCode?: string;
  /** Até quando o comprador pode avisar "Não recebi" (nulo se não pode). */
  readonly notReceivedUntil: string | null;
  readonly notReceivedAt: string | null;
  readonly notReceivedNote: string | null;
  readonly notReceivedResolution: string | null;
  /** Somente para o dono do pedido aguardando pagamento (RN-CFG-002). */
  readonly paymentInfo?: { pixKey: string | null; bankingDetails: string | null };
}

export interface CheckoutInput {
  readonly customerName?: string;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
  readonly notes?: string;
  readonly couponCode?: string;
  /** Ciência de que o item personalizado é feito sob medida e pode não ter desistência (DT-095). */
  readonly acceptPersonalized?: boolean;
  /** Quem compra sem conta pediu os avisos do pedido por WhatsApp (DT-096). */
  readonly whatsappOptIn?: boolean;
  /** Retirada (padrão) ou entrega em casa (DT-075). */
  readonly fulfillment?: OrderFulfillment;
  /** PIX (padrão, 30 min) ou `CARD` = cartão ou dinheiro, combinado com a diretoria (72 h) (DT-076). */
  readonly paymentChoice?: OrderPaymentChoice;
  /** Endereço digitado, ou `addressId` de um endereço salvo da conta. */
  readonly address?: AddressInput & { neighborhoodId: string };
  readonly addressId?: string;
  /** Guardar o endereço digitado na conta. */
  readonly saveAddress?: boolean;
}

export interface OrderFilters extends PageQueryDto {
  readonly status?: OrderStatus;
  readonly from?: string;
  readonly to?: string;
}

export const ORDER_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      productVariant: { select: { name: true } },
      salesCampaignProduct: {
        select: { salesCampaign: { select: { id: true, name: true, status: true } } }
      }
    }
  },
  payments: { select: { id: true, status: true, amount: true, isDeliveryFee: true } },
  couponRedemption: { select: { status: true, coupon: { select: { code: true } } } },
  deliveryAttempts: {
    where: { status: { in: ['OUT', 'DELIVERED'] } },
    orderBy: { dispatchedAt: 'desc' },
    take: 1,
    select: { courierName: true, vehicle: true, plate: true }
  }
} satisfies Prisma.OrderInclude;

/** Personalização travada no item do pedido, para telas e planilhas (DT-069). */
export function personalizationOfItem(details: unknown): { label: string; value: string }[] {
  const snapshot = (details as { personalizationSnapshot?: unknown } | null)
    ?.personalizationSnapshot;

  return Array.isArray(snapshot)
    ? snapshot
        .filter(
          (entry): entry is { label: string; value: string } =>
            typeof entry?.label === 'string' && typeof entry?.value === 'string'
        )
        .map((entry) => ({ label: entry.label, value: entry.value }))
    : [];
}

/** Resultado da baixa automática do PIX (DT-071): baixou, ou o motivo para a diretoria revisar. */
export type PixReceipt =
  | { readonly ok: true; readonly paymentId: string }
  | { readonly ok: false; readonly reason: string };

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Leitura de pedidos (RF-017, RF-018): monta a visão do pedido para o comprador e para a
 * diretoria, listas e totais. Usado pelos demais serviços de pedido (PEN-077).
 */
@Injectable()
export class OrderReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: AppConfig,
    private readonly settings: SettingsService
  ) {}

  /** `preloaded` evita uma consulta por pagamento nas listas (N+1). */
  async toView(
    row: OrderRow,
    preloaded?: ReadonlyMap<string, PaymentView>,
    forBuyer = false
  ): Promise<OrderView> {
    const views = preloaded ?? (await this.payments.views(row.payments.map((p) => p.id)));
    const payments = row.payments.flatMap((payment) => views.get(payment.id) ?? []);
    const confirmed = sum(
      row.payments.filter((p) => p.status === 'CONFIRMED').map((p) => p.amount)
    );
    const pending = sum(row.payments.filter((p) => p.status === 'PENDING').map((p) => p.amount));

    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      guestWhatsappOptIn: row.guestWhatsappOptInAt !== null,
      customerPhone: row.customerPhone,
      isGuest: row.customerUserId === null,
      subtotalAmount: moneyView(row.subtotalAmount, row.currency),
      discountAmount: moneyView(row.discountAmount, row.currency),
      coupon: row.couponRedemption
        ? {
            code: row.couponRedemption.coupon.code,
            released: row.couponRedemption.status === 'RELEASED'
          }
        : null,
      totalAmount: moneyView(row.totalAmount, row.currency),
      paidAmount: moneyView(confirmed, row.currency),
      pendingAmount: moneyView(pending, row.currency),
      notes: row.notes,
      items: row.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        variantName: item.productVariant.name,
        quantity: item.quantity,
        unitPrice: moneyView(item.unitPrice, item.currency),
        discountAmount: moneyView(item.discountAmount, item.currency),
        totalAmount: moneyView(item.totalAmount, item.currency),
        campaign: item.salesCampaignProduct?.salesCampaign ?? null,
        partnerId: item.partnerId,
        pickedUpAt: item.pickedUpAt?.toISOString() ?? null,
        arrivalNotifiedAt: item.arrivalNotifiedAt?.toISOString() ?? null,
        personalization: personalizationOfItem(item.details),
        beneficiaries: beneficiariesOf(item.details).map((b) => b.name)
      })),
      payments,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      readyForPickupAt: row.readyForPickupAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      deliveryConfirmedAt: row.deliveryConfirmedAt?.toISOString() ?? null,
      receiptConfirmedAt: row.receiptConfirmedAt?.toISOString() ?? null,
      hasDeliveryProof: row.deliveryProofMediaFileId !== null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancellationReason: row.cancellationReason,
      reservationExpiresAt: row.reservationExpiresAt?.toISOString() ?? null,
      fulfillment: row.fulfillment,
      paymentChoice: row.paymentChoice,
      deliveryFee: moneyView(row.deliveryFeeAmount, row.currency),
      deliveryAddress: (row.deliveryAddress as DeliveryAddress | null) ?? null,
      outForDeliveryAt: row.outForDeliveryAt?.toISOString() ?? null,
      deliveryProofKind: row.deliveryProofKind,
      courier: row.deliveryAttempts[0]
        ? {
            firstName: firstName(row.deliveryAttempts[0].courierName),
            vehicle: row.deliveryAttempts[0].vehicle,
            plate: row.deliveryAttempts[0].plate
          }
        : null,
      // O código nunca vai para o painel: só o comprador vê, e só com o pedido a caminho.
      ...(forBuyer && row.status === 'OUT_FOR_DELIVERY' && row.deliveryCodeEncrypted
        ? {
            deliveryCode: decryptField(
              row.deliveryCodeEncrypted,
              this.config.values.dataEncryptionKey
            )
          }
        : {}),
      notReceivedUntil: notReceivedDeadline(row, new Date())?.toISOString() ?? null,
      notReceivedAt: row.notReceivedAt?.toISOString() ?? null,
      notReceivedNote: row.notReceivedNote,
      notReceivedResolution: row.notReceivedResolution
    };
  }

  async load(tx: PrismaTx, id: string): Promise<OrderRow> {
    const row = await tx.order.findUnique({ where: { id }, include: ORDER_INCLUDE });

    if (row === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    return row;
  }

  /** Anexa dados de pagamento à visão do dono do pedido quando ainda há valor a pagar. */
  async withPaymentInfo(view: OrderView): Promise<OrderView> {
    return view.status === 'AWAITING_PAYMENT'
      ? { ...view, paymentInfo: await this.settings.getPaymentInfo() }
      : view;
  }

  async get(id: string): Promise<OrderView> {
    return this.toView(await this.load(this.prisma, id));
  }

  /**
   * Pedido na ficha da diretoria: inclui o titular do cartão pago pelo site (DT-100). Só a
   * rota da diretoria usa; respostas ao comprador usam `get`, sem esse campo.
   */
  async getForStaff(id: string): Promise<OrderView> {
    const [view, charge] = await Promise.all([
      this.get(id),
      this.prisma.cardCharge.findFirst({
        where: { orderId: id, status: { in: ['PAID', 'REVIEW'] } },
        orderBy: { createdAt: 'desc' },
        select: { holderName: true, holderDocumentMasked: true, brand: true, lastFour: true }
      })
    ]);

    return {
      ...view,
      cardHolder: charge
        ? {
            name: charge.holderName,
            document: charge.holderDocumentMasked,
            brand: charge.brand,
            lastFour: charge.lastFour
          }
        : null
    };
  }

  async list(filters: OrderFilters): Promise<Page<OrderView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const search = filters.search?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerEmail: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: startOfDayInZone(filters.from) } : {}),
              ...(filters.to ? { lt: endOfDayExclusive(filters.to) } : {})
            }
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      this.prisma.order.count({ where })
    ]);

    const payments = await this.payments.views(
      rows.flatMap((row) => row.payments.map((p) => p.id))
    );

    return toPage(
      await Promise.all(rows.map((row) => this.toView(row, payments))),
      total,
      page,
      pageSize
    );
  }

  async mine(userId: string): Promise<OrderView[]> {
    const rows = await this.prisma.order.findMany({
      where: { customerUserId: userId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const payments = await this.payments.views(
      rows.flatMap((row) => row.payments.map((p) => p.id))
    );

    return Promise.all(rows.map((row) => this.toView(row, payments)));
  }

  async getOwn(userId: string, id: string): Promise<OrderView> {
    const row = await this.load(this.prisma, id);

    if (row.customerUserId !== userId) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    return this.withPaymentInfo(await this.toView(row, undefined, true));
  }

  /** Vendas pagas no período (RF-020). */
  async salesTotal(from: Date, to: Date): Promise<{ count: number; amount: MoneyView }> {
    const aggregate = await this.prisma.order.aggregate({
      where: { paidAt: { gte: from, lt: to }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _count: true,
      _sum: { totalAmount: true }
    });

    return { count: aggregate._count, amount: moneyView(aggregate._sum.totalAmount ?? ZERO) };
  }
}
