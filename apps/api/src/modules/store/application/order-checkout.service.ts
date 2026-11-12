import { Injectable } from '@nestjs/common';
import type { OrderPaymentChoice, OrderStatus, Prisma } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { sha256Hex } from '../../../common/crypto/tokens';
import { formatBrl, type Money, sum, ZERO } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-context';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { AppConfig } from '../../../common/config/app-config';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { normalizeEmail } from '../../auth/domain/auth-rules';
import { lockRow } from '../../finance/application/ledger.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { effectiveCommission, splitCommission } from '../../partners/domain/partner-rules';
import {
  buyerLimitExceeded,
  generateOrderNumber,
  lineTotal,
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
import { DeliveryService, type ResolvedDelivery } from './delivery.service';
import { type AddressInput, addressLine, deliveryFee } from '../domain/delivery';
import { CARD_BUYER_MESSAGES, cardBuyerBlock } from '../../card-payment/domain/card-payment';
import { encryptField } from '../../../common/crypto/data-cipher';
import { beneficiariesOf, beneficiaryProblems, resizeBeneficiaries } from '../domain/cart-details';
import { plural } from '../../../common/domain/plural';
import { formatGuestCode, generateGuestCode, guestCodeHash } from '../domain/guest-access';
import { GuestMessagesService } from './guest-messages.service';
import { OrderView, CheckoutInput } from './order-view';
import { OrderReader } from './order-view';
import { OrderPaymentsService } from './order-payments.service';

/**
 * Checkout da loja (RF-017, RN-LOJ-007, DT-031): revalida preço, disponibilidade e limites no
 * servidor e cria o pedido com itens congelados e estoque reservado, numa transação.
 */
@Injectable()
export class OrderCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailSender,
    private readonly config: AppConfig,
    private readonly coupons: CouponsService,
    private readonly staffAlerts: StaffAlertsService,
    private readonly delivery: DeliveryService,
    private readonly guestMessages: GuestMessagesService,
    private readonly reader: OrderReader,
    private readonly orderPayments: OrderPaymentsService
  ) {}

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
          select: { name: true, email: true, phone: true, emailVerifiedAt: true }
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

    // DT-100: cartão pelo site só para conta com e-mail confirmado.
    const cardBlock =
      input.paymentChoice === 'ONLINE_CARD'
        ? cardBuyerBlock({
            hasAccount: profile !== null,
            emailVerified: Boolean(profile?.emailVerifiedAt)
          })
        : null;

    if (cardBlock !== null) {
      throw AppError.validation(
        cardBlock === 'ACCOUNT_REQUIRED' ? 'CARD_ACCOUNT_REQUIRED' : 'CARD_EMAIL_NOT_VERIFIED',
        CARD_BUYER_MESSAGES[cardBlock],
        [{ field: 'paymentChoice', code: cardBlock, message: CARD_BUYER_MESSAGES[cardBlock] }]
      );
    }

    const guestAccessCode = principal ? null : generateGuestCode();

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
              `Estoque insuficiente para "${product.name}" (${item.productVariant.name}): ${plural(available, 'disponível', 'disponíveis')}.`
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
            `"${product.name}" tem limite de ${plural(product.buyerLimit ?? 0, 'unidade', 'unidades')} por comprador.`
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
              'Confirme que está ciente: o item personalizado é feito sob medida e a desistência pode ser recusada.'
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
          guestAccessTokenHash: guestAccessCode ? guestCodeHash(guestAccessCode) : null,
          guestAccessCodeEncrypted: guestAccessCode
            ? encryptField(guestAccessCode, this.config.values.dataEncryptionKey)
            : null,
          // Consentimento do WhatsApp só para quem compra sem conta e informou o celular.
          guestWhatsappOptInAt:
            guestAccessCode && input.whatsappOptIn === true && customerPhone ? new Date() : null,
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
        await this.orderPayments.afterPaidInTx(tx, order.id);
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
            items: lines.length,
            whatsappOptIn: Boolean(guestAccessCode && input.whatsappOptIn === true && customerPhone)
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
            message: `Pedido ${orderNumber} criado. Total: ${formatBrl(total)}.`,
            link: `/minha-conta/pedidos/${order.id}`,
            deduplicationKey: `order-created:${order.id}`
          },
          tx
        );
      }

      return order.id;
    });

    const order = await this.reader.withPaymentInfo(await this.reader.get(orderId));
    const summary = [
      `Recebemos seu pedido ${order.orderNumber} no valor de ${formatBrl(order.totalAmount.amount)}.`,
      ...(order.deliveryAddress
        ? [
            `Entrega em casa: ${addressLine(order.deliveryAddress)} (taxa ${formatBrl(order.deliveryFee.amount)}, cerca de ${plural(order.deliveryAddress.leadDays, 'dia útil', 'dias úteis')} depois do pagamento).`
          ]
        : ['Retirada com o Fênix: avisamos quando o pedido estiver pronto.']),
      order.paymentChoice === 'CARD'
        ? 'Pagamento com cartão ou dinheiro: combine com a diretoria (maquininha, link de pagamento ou dinheiro na retirada/entrega). O pedido fica reservado por 72 horas.'
        : 'Pague por PIX em até 30 minutos pela página do pedido (QR ou chave com comprovante). Sem pagamento no prazo, o pedido é cancelado.'
    ];

    if (guestAccessCode) {
      // Sem conta: fila de avisos por e-mail e WhatsApp, com o link fixo do pedido (DT-096).
      const row = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: {
          id: true,
          customerUserId: true,
          customerEmail: true,
          customerPhone: true,
          guestWhatsappOptInAt: true
        }
      });

      await this.guestMessages.enqueue(
        this.prisma,
        row,
        'created',
        `Pedido ${order.orderNumber} recebido`,
        [
          ...summary,
          `Número do pedido: ${order.orderNumber}. Código de acesso: ${formatGuestCode(guestAccessCode)}.`
        ].join(' ')
      );
    } else {
      await this.mail
        .send({
          to: order.customerEmail ?? '',
          subject: `Pedido ${order.orderNumber} — Fênix Vôlei`,
          text: [
            `Olá, ${order.customerName}.`,
            '',
            ...summary,
            '',
            `Acompanhe em ${this.config.values.webOrigin}/minha-conta/pedidos`
          ].join('\n')
        })
        .catch(() => undefined);
    }

    await this.staffAlerts.alert(PERMISSIONS.ordersRead, {
      type: 'staff.order.created',
      title:
        order.paymentChoice === 'CARD' && order.status === 'AWAITING_PAYMENT'
          ? `Pedido ${order.orderNumber}: pagar com cartão ou dinheiro`
          : `Novo pedido ${order.orderNumber}`,
      message:
        order.paymentChoice === 'CARD' && order.status === 'AWAITING_PAYMENT'
          ? `Fale com ${order.customerName} (${order.customerPhone ?? 'sem telefone'}) para cobrar ${formatBrl(order.totalAmount.amount)}: maquininha, link ou dinheiro.`
          : `${order.customerName} · ${formatBrl(order.totalAmount.amount)}`,
      link: `/admin/pedidos/${order.id}`,
      key: `staff-order:${order.id}`
    });

    return { order, guestAccessCode: guestAccessCode ? formatGuestCode(guestAccessCode) : null };
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
}
