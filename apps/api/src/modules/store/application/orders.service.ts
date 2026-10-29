import { Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  DeliveryProofKind,
  OrderFulfillment,
  OrderPaymentChoice,
  OrderStatus,
  Prisma
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { generateOpaqueToken, sha256Hex } from '../../../common/crypto/tokens';
import {
  money,
  type Money,
  type MoneyView,
  moneyView,
  sum,
  ZERO
} from '../../../common/domain/money';
import { assertTransition } from '../../../common/domain/state-machine';
import { endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { SiteRevalidateService } from '../../../common/http/site-revalidate.interceptor';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { AppConfig } from '../../../common/config/app-config';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { normalizeEmail } from '../../auth/domain/auth-rules';
import { lockRow } from '../../finance/application/ledger.service';
import { PaymentsService, type PaymentView } from '../../finance/application/payments.service';
import { SYSTEM_CATEGORY } from '../../finance/domain/finance-catalog';
import {
  DOCUMENT_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { effectiveCommission, splitCommission } from '../../partners/domain/partner-rules';
import { SettingsService } from '../../settings/application/settings.service';
import {
  buyerLimitExceeded,
  generateOrderNumber,
  isPaidState,
  lineTotal,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  requiresStock,
  PIX_RESERVATION_MINUTES_DEFAULT,
  RESERVATION_HOURS_DEFAULT
} from '../domain/store-rules';
import {
  cartItemPrice,
  cartItemSellable,
  type CartOwner,
  CartService,
  checkRenewals,
  detailsJson,
  fieldsOf
} from './cart.service';
import {
  normalizePersonalization,
  personalizationSnapshot,
  personalizationValuesOf
} from '../domain/personalization';
import { type AppliedCoupon, CouponsService } from './coupons.service';
import { InventoryService } from './inventory.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { CardsService } from '../../cards/application/cards.service';
import { DeliveryService, type ResolvedDelivery } from './delivery.service';
import {
  type AddressInput,
  addressLine,
  type DeliveryAddress,
  deliveryFee,
  firstName,
  notReceivedDeadline,
  strongerProof
} from '../domain/delivery';
import { decryptField } from '../../../common/crypto/data-cipher';
import { beneficiariesOf, beneficiaryProblems, resizeBeneficiaries } from '../domain/cart-details';

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

export interface OrderView {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly customerName: string;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly isGuest: boolean;
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
  /** Ciência de que item personalizado não tem troca por arrependimento (DT-069). */
  readonly acceptPersonalized?: boolean;
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

const ORDER_INCLUDE = {
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

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Pedidos da loja (RF-016 a RF-018, RF-029, DT-031). Checkout reserva estoque em uma
 * transação; pagamento confirmado converte a reserva em saída e lança no Caixa.
 */
@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly mail: MailSender,
    private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly coupons: CouponsService,
    private readonly jobs: JobScheduler,
    private readonly site: SiteRevalidateService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly cards: CardsService,
    private readonly delivery: DeliveryService
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

  /**
   * Prazo para pagar (DT-076): PIX 30 minutos (`STORE_PIX_RESERVATION_MINUTES`); cartão com a
   * diretoria 72 horas (`STORE_RESERVATION_HOURS`). Sem pagamento no prazo, cancela sozinho.
   */
  private reservationMs(choice: OrderPaymentChoice): number {
    // Cartão pelo site paga na hora: mesmo prazo do PIX (DT-079).
    if (choice === 'PIX' || choice === 'ONLINE_CARD') {
      const minutes = Number(
        process.env['STORE_PIX_RESERVATION_MINUTES'] ?? PIX_RESERVATION_MINUTES_DEFAULT
      );

      return (
        (Number.isFinite(minutes) && minutes > 0 ? minutes : PIX_RESERVATION_MINUTES_DEFAULT) *
        60_000
      );
    }

    const value = Number(process.env['STORE_RESERVATION_HOURS'] ?? RESERVATION_HOURS_DEFAULT);

    return (Number.isFinite(value) && value > 0 ? value : RESERVATION_HOURS_DEFAULT) * 3_600_000;
  }

  /** `preloaded` evita uma consulta por pagamento nas listas (N+1). */
  private async toView(
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

  private async load(tx: PrismaTx, id: string): Promise<OrderRow> {
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

  /** Quantidade já comprada pelo mesmo comprador (pedidos não cancelados). */
  private async alreadyBought(
    tx: PrismaTx,
    productId: string,
    userId: string | null,
    email: string
  ): Promise<number> {
    const aggregate = await tx.orderItem.aggregate({
      where: {
        productId,
        order: {
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
          OR: [...(userId ? [{ customerUserId: userId }] : []), { customerEmail: email }]
        }
      },
      _sum: { quantity: true }
    });

    return aggregate._sum.quantity ?? 0;
  }

  /**
   * RF-017/RN-LOJ-007: revalida preço, disponibilidade e limites no servidor e cria o
   * pedido com itens congelados. Falha em qualquer item não cria pedido parcial.
   */
  async checkout(
    owner: CartOwner,
    input: CheckoutInput,
    meta: RequestMeta
  ): Promise<{ order: OrderView; guestAccessCode: string | null }> {
    const principal = owner.principal;
    const profile = principal
      ? await this.prisma.user.findUniqueOrThrow({
          where: { id: principal.userId },
          select: { name: true, email: true, phone: true }
        })
      : null;
    const customerName = input.customerName?.trim() || profile?.name || '';
    const customerEmail = input.customerEmail
      ? normalizeEmail(input.customerEmail)
      : (profile?.email ?? '');
    const customerPhone = input.customerPhone?.trim() || profile?.phone || '';

    if (!customerName || !customerEmail || !customerPhone) {
      throw AppError.validation(
        'CUSTOMER_REQUIRED',
        'Informe nome, e-mail e telefone para o pedido.',
        [
          ...(!customerName
            ? [{ field: 'customerName', code: 'REQUIRED', message: 'Informe o nome.' }]
            : []),
          ...(!customerEmail
            ? [{ field: 'customerEmail', code: 'REQUIRED', message: 'Informe o e-mail.' }]
            : []),
          ...(!customerPhone
            ? [{ field: 'customerPhone', code: 'REQUIRED', message: 'Informe o telefone.' }]
            : [])
        ]
      );
    }

    if (input.paymentChoice === 'ONLINE_CARD' && this.config.values.card.provider === 'off') {
      throw AppError.validation(
        'CARD_DISABLED',
        'O pagamento com cartão pelo site está desligado. Escolha PIX ou cartão com a diretoria.'
      );
    }

    const guestAccessCode = principal ? null : generateOpaqueToken(12);

    const orderId = await this.prisma.$transaction(async (tx) => {
      const cart = await this.carts.findActive(owner, tx);

      if (cart === null || cart.items.length === 0) {
        const converted = await tx.cart.findFirst({
          where: {
            ...(principal
              ? { userId: principal.userId }
              : { guestKeyHash: sha256Hex(`cart:${owner.guestToken ?? ''}`) }),
            status: 'CONVERTED'
          },
          orderBy: { updatedAt: 'desc' },
          select: { convertedOrderId: true, updatedAt: true }
        });

        // Reenvio imediato do mesmo checkout devolve o pedido já criado (idempotência).
        if (
          converted?.convertedOrderId &&
          Date.now() - converted.updatedAt.getTime() < 60_000 &&
          principal
        ) {
          return converted.convertedOrderId;
        }

        throw AppError.validation('EMPTY_CART', 'Seu carrinho está vazio.');
      }

      const campaignsInCart = new Set(
        cart.items.map((item) => item.salesCampaignProduct?.salesCampaignId ?? null)
      );

      // Pedido de remessa não se mistura com outros itens (DT-032).
      if (campaignsInCart.size > 1 && [...campaignsInCart].some((id) => id !== null)) {
        throw AppError.validation(
          'MIXED_CAMPAIGN_CART',
          'Produtos de remessa (pré-venda) precisam ser finalizados em um pedido separado, uma remessa por pedido.'
        );
      }

      const variantIds = [...new Set(cart.items.map((item) => item.productVariantId))].sort();

      for (const variantId of variantIds) {
        await lockRow(tx, 'variant', variantId);
      }

      const campaignIds = [
        ...new Set(
          cart.items
            .map((item) => item.salesCampaignProduct?.salesCampaignId)
            .filter((id): id is string => Boolean(id))
        )
      ].sort();

      for (const campaignId of campaignIds) {
        await lockRow(tx, 'campaign', campaignId);
      }

      const levels = await this.inventory.levels(variantIds, tx);
      const now = new Date();
      const lines: {
        item: (typeof cart.items)[number];
        unitPrice: Money;
        total: Money;
        details: Prisma.InputJsonObject | null;
      }[] = [];

      for (const item of cart.items) {
        const product = item.productVariant.product;

        if (!cartItemSellable(item, now)) {
          throw AppError.conflict(
            'PRODUCT_UNAVAILABLE',
            `"${product.name}" não está mais disponível. Remova-o do carrinho.`
          );
        }

        if (requiresStock(product.fulfillmentType)) {
          const available = levels.get(item.productVariantId)?.available ?? 0;

          if (available < item.quantity) {
            throw AppError.conflict(
              'INSUFFICIENT_STOCK',
              `Estoque insuficiente para "${product.name}" (${item.productVariant.name}): ${available} disponível(is).`
            );
          }
        }

        if (
          buyerLimitExceeded(
            product.buyerLimit,
            await this.alreadyBought(tx, product.id, principal?.userId ?? null, customerEmail),
            item.quantity
          )
        ) {
          throw AppError.conflict(
            'BUYER_LIMIT',
            `"${product.name}" tem limite de ${product.buyerLimit} unidade(s) por comprador.`
          );
        }

        if (item.salesCampaignProduct) {
          await this.assertCampaignCapacity(
            tx,
            item.salesCampaignProduct.salesCampaignId,
            item.salesCampaignProduct.id,
            item.quantity
          );
        }

        const unitPrice = cartItemPrice(item);
        let details: Prisma.InputJsonObject | null = null;

        // Afiliação (DT-068): conta obrigatória e um beneficiário completo por unidade.
        if (product.fulfillmentType === 'MEMBERSHIP') {
          if (!principal) {
            throw AppError.validation(
              'LOGIN_REQUIRED',
              'Entre na sua conta para comprar afiliação: as carteirinhas ficam nela.'
            );
          }

          const beneficiaries = resizeBeneficiaries(
            beneficiariesOf(item.details),
            item.quantity,
            null
          );
          const problem = beneficiaryProblems(beneficiaries)[0];

          if (problem) {
            throw AppError.validation('BENEFICIARIES_REQUIRED', problem.message);
          }

          details = detailsJson({
            beneficiaries: await checkRenewals(tx, principal.userId, beneficiaries)
          });
        }

        // Personalização (DT-069): conferida de novo e copiada travada para o pedido.
        const fields = fieldsOf(product);

        if (fields.length > 0) {
          const { values, problems } = normalizePersonalization(
            fields,
            personalizationValuesOf(item.details)
          );

          if (problems.length > 0) {
            throw AppError.validation(
              'PERSONALIZATION_INVALID',
              `"${product.name}": ${problems.join(' ')}`
            );
          }

          if (!input.acceptPersonalized) {
            throw AppError.validation(
              'PERSONALIZED_ACK_REQUIRED',
              'Confirme que está ciente: item personalizado não tem troca ou devolução por arrependimento.'
            );
          }

          details = detailsJson({
            personalization: values,
            personalizationSnapshot: personalizationSnapshot(fields, values)
          });
        }

        lines.push({
          item,
          unitPrice,
          total: lineTotal({ unitPrice, quantity: item.quantity }),
          details
        });
      }

      const subtotal = sum(lines.map((line) => line.total));
      // Cupom (DT-045): conferido de novo aqui, com a linha do cupom travada.
      const coupon: AppliedCoupon | null = input.couponCode?.trim()
        ? await this.coupons.applyInTx(
            tx,
            input.couponCode,
            principal,
            customerEmail,
            lines.map((line) => ({
              productId: line.item.productVariant.product.id,
              categoryId: line.item.productVariant.product.productCategoryId,
              partnerId: line.item.productVariant.product.partnerId,
              total: line.total
            }))
          )
        : null;
      const discount = coupon?.discount ?? ZERO;
      // Entrega em casa (DT-075): pedido só de afiliação não tem o que entregar.
      const onlyMembership = lines.every(
        (line) => line.item.productVariant.product.fulfillmentType === 'MEMBERSHIP'
      );
      const delivery =
        input.fulfillment === 'DELIVERY' && !onlyMembership
          ? await this.delivery.resolveInTx(
              tx,
              await this.deliveryAddressInput(tx, principal?.userId ?? null, input)
            )
          : null;
      const productsTotal = subtotal.minus(discount);
      const fee = delivery
        ? deliveryFee({
            zoneFee: delivery.zoneFee,
            productsTotal,
            freeMinimum: delivery.freeMinimum
          })
        : ZERO;
      const total = productsTotal.plus(fee);
      let orderNumber = generateOrderNumber(now);

      while (await tx.order.findUnique({ where: { orderNumber }, select: { id: true } })) {
        orderNumber = generateOrderNumber(now);
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerUserId: principal?.userId ?? null,
          customerName,
          customerEmail,
          customerPhone,
          subtotalAmount: subtotal,
          discountAmount: discount,
          totalAmount: total,
          currency: 'BRL',
          status: total.greaterThan(0) ? 'AWAITING_PAYMENT' : 'PAID',
          notes: input.notes?.trim() || null,
          guestAccessTokenHash: guestAccessCode ? sha256Hex(`order:${guestAccessCode}`) : null,
          paymentChoice: input.paymentChoice ?? 'PIX',
          reservationExpiresAt: new Date(
            now.getTime() + this.reservationMs(input.paymentChoice ?? 'PIX')
          ),
          ...(delivery
            ? {
                fulfillment: 'DELIVERY' as const,
                deliveryFeeAmount: fee,
                deliveryZoneId: delivery.zoneId,
                // Interface sem assinatura de índice: o JSON do Prisma pede o cast.
                deliveryAddress: {
                  ...delivery.address,
                  phone: delivery.address.phone ?? customerPhone
                } as unknown as Prisma.InputJsonObject
              }
            : {})
        }
      });

      if (delivery && principal && input.saveAddress && input.address && !input.addressId) {
        await this.saveAddressInTx(tx, principal.userId, input.address, delivery);
      }

      for (const [index, line] of lines.entries()) {
        const product = line.item.productVariant.product;
        const lineDiscount = coupon?.perLine[index] ?? ZERO;
        // RN-PAR-002: congela a regra de comissão vigente no item (PEN-035, DT-033).
        const commission = product.partner
          ? (() => {
              const rule = effectiveCommission(product.partner, product);
              const split = splitCommission(rule, line.total, line.item.quantity);

              return {
                commissionTypeSnapshot: rule.type,
                commissionRateSnapshot: rule.type === 'PERCENTAGE' ? rule.percentage : null,
                commissionFixedSnapshot: rule.type === 'FIXED' ? rule.fixedAmount : null,
                partnerAmountSnapshot: split.partnerAmount
              };
            })()
          : {};
        const created = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            productVariantId: line.item.productVariantId,
            salesCampaignProductId: line.item.salesCampaignProductId,
            partnerId: product.partnerId,
            productName: product.name,
            sku: line.item.productVariant.sku,
            selectedAttributes: {
              variant: line.item.productVariant.name,
              size: line.item.productVariant.size,
              color: line.item.productVariant.color
            },
            quantity: line.item.quantity,
            ...(line.details ? { details: line.details } : {}),
            unitPrice: line.unitPrice,
            discountAmount: lineDiscount,
            totalAmount: line.total.minus(lineDiscount),
            currency: 'BRL',
            ...commission
          }
        });

        if (requiresStock(product.fulfillmentType)) {
          await this.inventory.record(tx, {
            variantId: line.item.productVariantId,
            type: 'RESERVATION',
            quantity: line.item.quantity,
            orderItemId: created.id,
            reason: `Pedido ${orderNumber}`,
            actorId: principal?.userId ?? null
          });
        }
      }

      if (order.status === 'PAID') {
        await this.afterPaidInTx(tx, order.id);
      }

      if (coupon) {
        await this.coupons.redeemInTx(
          tx,
          coupon,
          order.id,
          principal?.userId ?? null,
          customerEmail
        );
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CONVERTED', convertedOrderId: order.id }
      });
      await this.audit.record(
        {
          actorUserId: principal?.userId ?? null,
          action: 'order.created',
          entityType: 'Order',
          entityId: order.id,
          after: {
            orderNumber,
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            coupon: coupon?.code ?? null,
            fulfillment: delivery ? 'DELIVERY' : 'PICKUP',
            deliveryFee: fee.toFixed(2),
            total: total.toFixed(2),
            items: lines.length
          },
          meta
        },
        tx
      );

      if (principal) {
        await this.notifications.notify(
          {
            userId: principal.userId,
            type: 'order.created',
            title: 'Pedido recebido',
            message: `Pedido ${orderNumber} criado. Total: R$ ${total.toFixed(2).replace('.', ',')}.`,
            link: `/minha-conta/pedidos/${order.id}`,
            deduplicationKey: `order-created:${order.id}`
          },
          tx
        );
      }

      return order.id;
    });

    const order = await this.withPaymentInfo(await this.get(orderId));

    await this.mail
      .send({
        to: order.customerEmail ?? '',
        subject: `Pedido ${order.orderNumber} — Fênix Vôlei`,
        text: [
          `Olá, ${order.customerName}.`,
          '',
          `Recebemos seu pedido ${order.orderNumber} no valor de R$ ${order.totalAmount.amount.replace('.', ',')}.`,
          ...(order.deliveryAddress
            ? [
                `Entrega em casa: ${addressLine(order.deliveryAddress)} (taxa R$ ${order.deliveryFee.amount.replace('.', ',')}, cerca de ${order.deliveryAddress.leadDays} dia(s) útil(eis) depois do pagamento).`
              ]
            : ['Retirada com o Fênix: avisamos quando o pedido estiver pronto.']),
          order.paymentChoice === 'CARD'
            ? 'Pagamento com cartão ou dinheiro: combine com a diretoria (maquininha, link de pagamento ou dinheiro na retirada/entrega). O pedido fica reservado por 72 horas.'
            : 'Pague por PIX em até 30 minutos pela página do pedido (QR ou chave com comprovante). Sem pagamento no prazo, o pedido é cancelado.',
          ...(guestAccessCode
            ? [
                '',
                `Para acompanhar, acesse ${this.config.values.webOrigin}/loja/pedido e informe o número do pedido e o código: ${guestAccessCode}`
              ]
            : [`Acompanhe em ${this.config.values.webOrigin}/minha-conta/pedidos`])
        ].join('\n')
      })
      .catch(() => undefined);

    await this.staffAlerts.alert(PERMISSIONS.ordersRead, {
      type: 'staff.order.created',
      title:
        order.paymentChoice === 'CARD' && order.status === 'AWAITING_PAYMENT'
          ? `Pedido ${order.orderNumber}: pagar com cartão ou dinheiro`
          : `Novo pedido ${order.orderNumber}`,
      message:
        order.paymentChoice === 'CARD' && order.status === 'AWAITING_PAYMENT'
          ? `Fale com ${order.customerName} (${order.customerPhone ?? 'sem telefone'}) para cobrar R$ ${order.totalAmount.amount.replace('.', ',')}: maquininha, link ou dinheiro.`
          : `${order.customerName} · R$ ${order.totalAmount.amount.replace('.', ',')}`,
      link: `/admin/pedidos/${order.id}`,
      key: `staff-order:${order.id}`
    });

    return { order, guestAccessCode };
  }

  /** Limite máximo da campanha (RCF-009), contando pedidos não cancelados. */
  private async assertCampaignCapacity(
    tx: PrismaTx,
    campaignId: string,
    linkId: string,
    quantity: number
  ): Promise<void> {
    const campaign = await tx.salesCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { maximumQuantity: true, name: true }
    });
    const link = await tx.salesCampaignProduct.findUniqueOrThrow({
      where: { id: linkId },
      select: { maximumQuantity: true }
    });
    const active = { order: { status: { notIn: ['CANCELLED', 'REFUNDED'] as OrderStatus[] } } };
    const [campaignSold, productSold] = await Promise.all([
      tx.orderItem.aggregate({
        where: { ...active, salesCampaignProduct: { salesCampaignId: campaignId } },
        _sum: { quantity: true }
      }),
      tx.orderItem.aggregate({
        where: { ...active, salesCampaignProductId: linkId },
        _sum: { quantity: true }
      })
    ]);

    if (
      campaign.maximumQuantity !== null &&
      (campaignSold._sum.quantity ?? 0) + quantity > campaign.maximumQuantity
    ) {
      throw AppError.conflict(
        'CAMPAIGN_FULL',
        `A remessa "${campaign.name}" atingiu o limite de unidades.`
      );
    }

    if (
      link.maximumQuantity !== null &&
      (productSold._sum.quantity ?? 0) + quantity > link.maximumQuantity
    ) {
      throw AppError.conflict('CAMPAIGN_PRODUCT_FULL', 'Este produto atingiu o limite da remessa.');
    }
  }

  // ---------- Consulta ----------

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

  /** Consulta segura de visitante: número + código secreto, resposta idêntica para erro. */
  async guestLookup(orderNumber: string, code: string): Promise<OrderView> {
    const row = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim().toUpperCase(),
        guestAccessTokenHash: sha256Hex(`order:${code.trim()}`)
      },
      include: ORDER_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Pedido não encontrado. Confira o número e o código.');
    }

    return this.withPaymentInfo(await this.toView(row, undefined, true));
  }

  // ---------- Pagamento ----------

  /**
   * Depois do pagamento: afiliações viram carteirinhas (DT-068). Pedido só de afiliação já
   * está entregue (não há o que retirar); a entrega é a ativação.
   */
  private async afterPaidInTx(tx: PrismaTx, orderId: string): Promise<void> {
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

    const refreshed = await this.load(tx, row.id);
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

  /** Endereço do checkout: digitado ou um salvo da própria conta. */
  private async deliveryAddressInput(
    tx: PrismaTx,
    userId: string | null,
    input: CheckoutInput
  ): Promise<AddressInput & { neighborhoodId: string }> {
    if (input.addressId) {
      const saved = userId ? await this.delivery.ownAddress(tx, userId, input.addressId) : null;

      if (saved === null) {
        throw AppError.notFound('Endereço não encontrado.');
      }

      return {
        postalCode: saved.postalCode,
        street: saved.street,
        number: saved.number,
        complement: saved.complement,
        reference: saved.reference,
        phone: saved.phone,
        neighborhoodId: saved.neighborhoodId ?? ''
      };
    }

    if (!input.address) {
      throw AppError.validation('ADDRESS_REQUIRED', 'Informe o endereço de entrega.');
    }

    return input.address;
  }

  /** "Guardar na minha conta" no checkout: até 10 endereços; o primeiro vira o padrão. */
  private async saveAddressInTx(
    tx: PrismaTx,
    userId: string,
    input: AddressInput & { neighborhoodId: string },
    delivery: ResolvedDelivery
  ): Promise<void> {
    const count = await tx.userAddress.count({ where: { userId } });

    if (count >= 10) {
      return;
    }

    await tx.userAddress.create({
      data: {
        userId,
        postalCode: delivery.address.postalCode,
        street: delivery.address.street,
        number: delivery.address.number,
        complement: delivery.address.complement,
        neighborhoodId: input.neighborhoodId,
        neighborhood: delivery.address.neighborhood,
        city: delivery.address.city,
        state: delivery.address.state,
        reference: delivery.address.reference,
        phone: delivery.address.phone,
        isDefault: count === 0
      }
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
    const row = await this.load(tx, orderId);

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
      await this.confirmInTx(tx, null, await this.load(tx, orderId), payment.id, input.accountId);
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
      const row = await this.load(tx, id);

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
          await this.load(tx, id),
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

    return this.get(id);
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
      const row = await this.load(tx, id);

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

    return this.get(id);
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
      const row = await this.load(tx, order.id);

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

    const view = await this.get(order.id);

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

  // ---------- Estados ----------

  private async notifyStatus(tx: PrismaTx, row: OrderRow, status: OrderStatus): Promise<void> {
    if (!row.customerUserId) {
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
        deduplicationKey: `order-status:${row.id}:${status}`
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
      const row = await this.load(tx, id);

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

    return this.get(id);
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
    const row = await this.load(tx, orderId);

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
    const row = await this.load(tx, orderId);

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
    const row = await this.load(tx, orderId);

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

  /**
   * O comprador cancela o próprio pedido enquanto não pagou (DT-076): sem comprovante em
   * análise. Depois de pago, vale a desistência em 7 dias (DT-070).
   */
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
              guestAccessTokenHash: sha256Hex(`order:${owner.code.trim()}`)
            },
      select: { id: true }
    });

    if (found === null) {
      throw AppError.notFound('Pedido não encontrado.');
    }

    const reason = 'Cancelado pelo comprador antes do pagamento';

    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'order', found.id);
      const row = await this.load(tx, found.id);

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

    return this.toView(await this.load(this.prisma, found.id), undefined, true);
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
        const row = await this.load(tx, id);

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
