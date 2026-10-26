import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

import { generateOpaqueToken, sha256Hex } from '../../../common/crypto/tokens';
import { type MoneyView, moneyView, round2, sum } from '../../../common/domain/money';
import { civilDateOf } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import type { Principal } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { mediaUrl } from '../../media/application/media.service';
import { partnerOperational } from '../../partners/domain/partner-rules';
import {
  effectiveUnitPrice,
  isPurchasable,
  lineTotal,
  MAX_ITEM_QUANTITY,
  requiresStock
} from '../domain/store-rules';
import { InventoryService } from './inventory.service';

export const CART_TTL_DAYS = 30;

export interface CartOwner {
  readonly principal?: Principal | undefined;
  readonly guestToken?: string | undefined;
}

export interface CartLine {
  readonly id: string;
  readonly productId: string;
  readonly productSlug: string;
  readonly productName: string;
  readonly variantId: string;
  readonly variantName: string;
  readonly sku: string;
  readonly image: string | null;
  readonly quantity: number;
  readonly unitPrice: MoneyView;
  readonly lineTotal: MoneyView;
  readonly campaign: { slug: string; name: string } | null;
  readonly warning: 'UNAVAILABLE' | 'INSUFFICIENT_STOCK' | null;
  readonly available: number | null;
  /** Opções do mesmo produto, para trocar no carrinho (DT-051). */
  readonly options: CartOption[];
}

export interface CartOption {
  readonly variantId: string;
  readonly name: string;
  /** Unidades disponíveis; nulo quando o produto não controla estoque (encomenda, pré-venda). */
  readonly available: number | null;
}

export interface CartView {
  readonly id: string | null;
  readonly lines: CartLine[];
  readonly itemCount: number;
  readonly total: MoneyView;
  readonly hasWarnings: boolean;
}

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      productVariant: {
        include: {
          product: {
            include: {
              images: {
                where: { deletedAt: null },
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                take: 1
              },
              variants: {
                where: { deletedAt: null, isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true }
              },
              partner: {
                select: {
                  status: true,
                  deletedAt: true,
                  contractStartsOn: true,
                  contractEndsOn: true,
                  commissionType: true,
                  commissionPercentage: true,
                  commissionFixedAmount: true
                }
              }
            }
          }
        }
      },
      salesCampaignProduct: { include: { salesCampaign: true } }
    }
  }
} satisfies Prisma.CartInclude;

export type CartRow = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;
export type CartItemRow = CartRow['items'][number];

/** Preço vigente de um item (campanha aberta tem precedência). */
export function cartItemPrice(item: CartItemRow) {
  const product = item.productVariant.product;

  return round2(
    item.salesCampaignProduct?.campaignPrice ?? effectiveUnitPrice(product, item.productVariant)
  );
}

/** O item continua vendável? Campanha precisa estar aberta e dentro da janela. */
export function cartItemSellable(item: CartItemRow, now: Date): boolean {
  const product = item.productVariant.product;
  const variantOk =
    item.productVariant.isActive &&
    item.productVariant.deletedAt === null &&
    product.deletedAt === null;
  const partnerOk =
    product.partnerId === null ||
    (product.partner !== null && partnerOperational(product.partner, civilDateOf(now)));

  if (!variantOk || !partnerOk) {
    return false;
  }

  if (product.fulfillmentType === 'CAMPAIGN') {
    const link = item.salesCampaignProduct;
    const campaign = link?.salesCampaign;

    return (
      product.status === 'ACTIVE' &&
      link !== null &&
      link !== undefined &&
      link.isActive &&
      campaign !== undefined &&
      campaign.status === 'OPEN' &&
      now >= campaign.salesStartAt &&
      now <= campaign.salesEndAt
    );
  }

  return isPurchasable(product, now);
}

/**
 * Carrinho no servidor (RF-037): o preço nunca vem do cliente e é recalculado a cada
 * leitura. Visitante é identificado por token opaco em cookie HttpOnly (somente hash no banco).
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService
  ) {}

  private ownerWhere(owner: CartOwner): Prisma.CartWhereInput | null {
    if (owner.principal) {
      return { userId: owner.principal.userId };
    }

    if (owner.guestToken) {
      return { guestKeyHash: sha256Hex(`cart:${owner.guestToken}`), userId: null };
    }

    return null;
  }

  async findActive(owner: CartOwner, tx?: PrismaTx): Promise<CartRow | null> {
    const where = this.ownerWhere(owner);

    if (where === null) {
      return null;
    }

    return (tx ?? this.prisma).cart.findFirst({
      where: { ...where, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: CART_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
  }

  /** Une o carrinho de visitante ao do usuário após login. */
  async mergeGuest(principal: Principal, guestToken: string | undefined): Promise<void> {
    if (!guestToken) {
      return;
    }

    const guest = await this.findActive({ guestToken });

    if (guest === null || guest.items.length === 0) {
      return;
    }

    for (const item of guest.items) {
      const own = await this.findActive({ principal });
      const existing = own?.items.find((i) => i.productVariantId === item.productVariantId);
      const quantity = Math.min(MAX_ITEM_QUANTITY, (existing?.quantity ?? 0) + item.quantity);

      try {
        await this.setItem({ principal }, item.productVariantId, quantity);
      } catch {
        // Itens indisponíveis não impedem a mesclagem dos demais.
      }
    }

    await this.prisma.cart.update({ where: { id: guest.id }, data: { status: 'ABANDONED' } });
  }

  async view(owner: CartOwner): Promise<CartView> {
    const cart = await this.findActive(owner);

    return this.toView(cart);
  }

  async toView(cart: CartRow | null): Promise<CartView> {
    if (cart === null) {
      return { id: null, lines: [], itemCount: 0, total: moneyView(null), hasWarnings: false };
    }

    const now = new Date();
    const levels = await this.inventory.levels([
      ...new Set(
        cart.items.flatMap((item) => [
          item.productVariantId,
          ...item.productVariant.product.variants.map((variant) => variant.id)
        ])
      )
    ]);
    const lines: CartLine[] = cart.items.map((item) => {
      const product = item.productVariant.product;
      const unit = cartItemPrice(item);
      const tracked = requiresStock(product.fulfillmentType);
      const available = tracked ? (levels.get(item.productVariantId)?.available ?? 0) : null;
      const sellable = cartItemSellable(item, now);
      const image = product.images[0];

      return {
        id: item.id,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        variantId: item.productVariantId,
        variantName: item.productVariant.name,
        sku: item.productVariant.sku,
        image: image ? mediaUrl(image.mediaFileId) : null,
        quantity: item.quantity,
        unitPrice: moneyView(unit),
        lineTotal: moneyView(lineTotal({ unitPrice: unit, quantity: item.quantity })),
        campaign: item.salesCampaignProduct
          ? {
              slug: item.salesCampaignProduct.salesCampaign.slug,
              name: item.salesCampaignProduct.salesCampaign.name
            }
          : null,
        warning: !sellable
          ? 'UNAVAILABLE'
          : available !== null && available < item.quantity
            ? 'INSUFFICIENT_STOCK'
            : null,
        available,
        options: product.variants.map((variant) => ({
          variantId: variant.id,
          name: variant.name,
          available: tracked ? (levels.get(variant.id)?.available ?? 0) : null
        }))
      };
    });

    return {
      id: cart.id,
      lines,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      total: moneyView(
        sum(
          lines.map((line) =>
            round2(
              lineTotal({
                unitPrice: cartItemPrice(cart.items.find((i) => i.id === line.id) as CartItemRow),
                quantity: line.quantity
              })
            )
          )
        )
      ),
      hasWarnings: lines.some((line) => line.warning !== null)
    };
  }

  /**
   * Troca a opção de um item (ex.: tamanho M por G), somando se a nova opção já estiver no
   * carrinho. A nova opção é validada antes (estoque, limite); só então a antiga sai.
   */
  async changeVariant(
    owner: CartOwner,
    fromVariantId: string,
    toVariantId: string,
    quantity: number
  ): Promise<{ view: CartView; newGuestToken: string | null }> {
    const cart = await this.findActive(owner);
    const current = cart?.items.find((item) => item.productVariantId === fromVariantId);

    if (!cart || !current) {
      throw AppError.notFound('Item não está no carrinho.');
    }

    if (fromVariantId === toVariantId) {
      return this.setItem(owner, toVariantId, quantity);
    }

    const target = await this.prisma.productVariant.findFirst({
      where: { id: toVariantId, deletedAt: null, isActive: true },
      select: { productId: true }
    });

    if (target === null || target.productId !== current.productVariant.productId) {
      throw AppError.validation('INVALID_OPTION', 'Escolha uma opção deste mesmo produto.');
    }

    const existing = cart.items.find((item) => item.productVariantId === toVariantId);
    const merged = Math.min(MAX_ITEM_QUANTITY, (existing?.quantity ?? 0) + quantity);
    const result = await this.setItem(owner, toVariantId, merged);

    return {
      ...(await this.setItem(owner, fromVariantId, 0)),
      newGuestToken: result.newGuestToken
    };
  }

  /**
   * Define a quantidade de uma variação (0 remove). Retorna o token de visitante
   * quando um carrinho anônimo é criado.
   */
  async setItem(
    owner: CartOwner,
    variantId: string,
    quantity: number
  ): Promise<{ view: CartView; newGuestToken: string | null }> {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_ITEM_QUANTITY) {
      throw AppError.validation(
        'INVALID_QUANTITY',
        `Quantidade deve ser entre 0 e ${MAX_ITEM_QUANTITY}.`
      );
    }

    let newGuestToken: string | null = null;
    const now = new Date();
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
      include: {
        product: {
          include: {
            partner: {
              select: {
                status: true,
                deletedAt: true,
                contractStartsOn: true,
                contractEndsOn: true
              }
            },
            campaignProducts: {
              where: {
                isActive: true,
                deletedAt: null,
                salesCampaign: {
                  status: 'OPEN',
                  salesStartAt: { lte: now },
                  salesEndAt: { gte: now }
                }
              },
              select: { id: true },
              take: 1
            }
          }
        }
      }
    });

    if (variant === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    const product = variant.product;
    const campaignLinkId =
      product.fulfillmentType === 'CAMPAIGN' ? (product.campaignProducts[0]?.id ?? null) : null;
    const sellable =
      variant.isActive &&
      (product.partnerId === null ||
        (product.partner !== null && partnerOperational(product.partner, civilDateOf(now)))) &&
      (product.fulfillmentType === 'CAMPAIGN'
        ? product.status === 'ACTIVE' && campaignLinkId !== null
        : isPurchasable(product, now));

    if (quantity > 0 && !sellable) {
      throw AppError.conflict(
        'PRODUCT_UNAVAILABLE',
        'Este produto não está disponível para compra no momento.'
      );
    }

    if (quantity > 0 && product.buyerLimit !== null && quantity > product.buyerLimit) {
      throw AppError.validation(
        'BUYER_LIMIT',
        `Limite de ${product.buyerLimit} unidade(s) por comprador.`
      );
    }

    if (quantity > 0 && requiresStock(product.fulfillmentType)) {
      const available = (await this.inventory.levels([variantId])).get(variantId)?.available ?? 0;

      if (quantity > available) {
        throw AppError.conflict(
          'INSUFFICIENT_STOCK',
          available > 0 ? `Apenas ${available} unidade(s) disponível(is).` : 'Produto esgotado.'
        );
      }
    }

    let cart = await this.findActive(owner);

    if (cart === null) {
      if (quantity === 0) {
        return { view: await this.toView(null), newGuestToken: null };
      }

      const data: Prisma.CartUncheckedCreateInput = {
        expiresAt: new Date(Date.now() + CART_TTL_DAYS * 86_400_000),
        ...(owner.principal ? { userId: owner.principal.userId } : {})
      };

      if (!owner.principal) {
        newGuestToken = owner.guestToken ?? generateOpaqueToken();
        data.guestKeyHash = sha256Hex(`cart:${newGuestToken}`);
      }

      await this.prisma.cart.create({ data });
      cart = await this.findActive(
        owner.principal ? owner : { guestToken: newGuestToken ?? undefined }
      );
    }

    if (cart === null) {
      throw new Error('Carrinho não pôde ser criado.');
    }

    const existing = cart.items.find((item) => item.productVariantId === variantId);

    if (quantity === 0) {
      if (existing) {
        await this.prisma.cartItem.delete({ where: { id: existing.id } });
      }
    } else if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity, salesCampaignProductId: campaignLinkId }
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: variantId,
          quantity,
          salesCampaignProductId: campaignLinkId
        }
      });
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { expiresAt: new Date(Date.now() + CART_TTL_DAYS * 86_400_000) }
    });

    return {
      view: await this.toView(
        await this.findActive(
          owner.principal ? owner : { guestToken: newGuestToken ?? owner.guestToken }
        )
      ),
      newGuestToken
    };
  }
}

/** Favoritos privados e idempotentes (RF-038, RN-LOJ-008). */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string
  ): Promise<{ productId: string; slug: string; name: string; image: string | null }[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, product: { deletedAt: null, status: { not: 'ARCHIVED' } } },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: { where: { deletedAt: null }, orderBy: [{ isPrimary: 'desc' }], take: 1 }
          }
        }
      }
    });

    return rows.map((row) => ({
      productId: row.productId,
      slug: row.product.slug,
      name: row.product.name,
      image: row.product.images[0] ? mediaUrl(row.product.images[0].mediaFileId) : null
    }));
  }

  async add(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, status: { in: ['ACTIVE', 'SOLD_OUT'] } }
    });

    if (product === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    await this.prisma.favorite.createMany({ data: [{ userId, productId }], skipDuplicates: true });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
  }
}
