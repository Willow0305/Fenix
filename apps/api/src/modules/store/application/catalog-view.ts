import { Injectable } from '@nestjs/common';
import type {
  CommissionType,
  Gender,
  Prisma,
  ProductFulfillmentType,
  ProductStatus
} from '../../../generated/prisma/client';
import { type Money, money, type MoneyView, moneyView } from '../../../common/domain/money';
import { civilDateOf } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { mediaUrl } from '../../media/application/media.service';
import { operationalPartnerWhere, partnerOperational } from '../../partners/domain/partner-rules';
import { slugify } from '../../sports/domain/sports-rules';
import {
  effectiveUnitPrice,
  isPurchasable,
  LOW_STOCK_THRESHOLD,
  listPrice,
  requiresStock
} from '../domain/store-rules';
import { InventoryService, type StockLevel } from './inventory.service';

export interface ProductCategoryView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly isActive: boolean;
}

export interface VariantView {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly size: string | null;
  readonly color: string | null;
  readonly model: string | null;
  readonly gender: Gender | null;
  readonly price: MoneyView;
  readonly listPrice: MoneyView;
  readonly isActive: boolean;
  readonly minimumStock: number;
  readonly stock: StockLevel | null;
  readonly inStock: boolean;
  /** Restam poucas unidades (sem revelar quantas). */
  readonly lowStock: boolean;
}

export interface PersonalizationFieldView {
  readonly id: string;
  readonly label: string;
  readonly kind: 'TEXT' | 'NUMBER';
  readonly required: boolean;
  readonly maxLength: number | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly uppercase: boolean;
  readonly extraPrice: MoneyView;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export interface PersonalizationFieldInput {
  readonly label: string;
  readonly kind: 'TEXT' | 'NUMBER';
  readonly required?: boolean;
  readonly maxLength?: number | null;
  readonly minValue?: number | null;
  readonly maxValue?: number | null;
  readonly uppercase?: boolean;
  readonly extraPrice?: Money;
  readonly sortOrder?: number;
  readonly isActive?: boolean;
}

export const MEMBERSHIP_CATEGORY = 'Afiliação';

export interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly category: { id: string; name: string; slug: string };
  readonly fulfillmentType: ProductFulfillmentType;
  readonly status: ProductStatus;
  readonly isFeatured: boolean;
  readonly priceFrom: MoneyView;
  readonly listPriceFrom: MoneyView;
  readonly image: { url: string; altText: string | null } | null;
  readonly purchasable: boolean;
  /** Logo do parceiro para o selo no canto da imagem (docs/29 COR-014). */
  readonly partner: { id: string; name: string; logoUrl: string | null } | null;
  readonly campaign: { slug: string; name: string; salesEndAt: string } | null;
}

export interface ProductDetail extends ProductSummary {
  readonly description: string | null;
  readonly buyerLimit: number | null;
  readonly productionLeadDays: number | null;
  /** Validade da afiliação em meses (DT-068); nulo nos demais produtos. */
  readonly membershipMonths: number | null;
  /** Quando o aviso "afiliações abertas" foi enviado (só uma vez). */
  readonly membershipAnnouncedAt: string | null;
  readonly pickupInstructions: string | null;
  /** Guia de medidas (DT-069). */
  readonly sizeGuide: string | null;
  /** Cartão (DT-079): parcelas sem juros até N; nulo = só com juros. */
  readonly interestFreeInstallments: number | null;
  /** Campos de personalização ativos (na visão do painel, todos). */
  readonly personalizationFields: PersonalizationFieldView[];
  readonly isPersonalized: boolean;
  readonly availableFrom: string | null;
  readonly availableUntil: string | null;
  readonly images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
  readonly variants: VariantView[];
  readonly costPrice?: MoneyView | null;
  readonly basePrice?: MoneyView;
  readonly promotionalPrice?: MoneyView | null;
  /** Somente na visão administrativa: regra própria do produto (sobrepõe a do parceiro). */
  readonly commissionOverride?: {
    type: CommissionType;
    percentage: string | null;
    fixedAmount: MoneyView | null;
  } | null;
}

export interface ProductInput {
  readonly name: string;
  readonly categoryId: string;
  readonly fulfillmentType: ProductFulfillmentType;
  readonly basePrice: Money;
  readonly promotionalPrice?: Money | null;
  readonly costPrice?: Money | null;
  readonly brand?: string | null;
  readonly description?: string | null;
  readonly buyerLimit?: number | null;
  readonly isFeatured?: boolean;
  readonly availableFrom?: string | null;
  readonly availableUntil?: string | null;
  readonly productionLeadDays?: number | null;
  readonly membershipMonths?: number | null;
  readonly sizeGuide?: string | null;
  readonly interestFreeInstallments?: number | null;
  readonly pickupInstructions?: string | null;
  readonly partnerId?: string | null;
  readonly commissionTypeOverride?: CommissionType | null;
  readonly commissionPercentageOverride?: Money | null;
  readonly commissionFixedOverride?: Money | null;
}

export interface VariantInput {
  readonly name: string;
  readonly sku?: string;
  readonly size?: string | null;
  readonly color?: string | null;
  readonly model?: string | null;
  readonly gender?: Gender | null;
  readonly priceOverride?: Money | null;
  readonly promotionalPriceOverride?: Money | null;
  readonly minimumStock?: number;
  readonly isActive?: boolean;
}

export const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  partner: {
    select: {
      id: true,
      displayName: true,
      status: true,
      deletedAt: true,
      contractStartsOn: true,
      contractEndsOn: true,
      logoMediaFileId: true
    }
  },
  images: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: { id: true, mediaFileId: true, altText: true, isPrimary: true }
  },
  variants: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
  personalizationFields: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  },
  campaignProducts: {
    where: { isActive: true, deletedAt: null, salesCampaign: { status: 'OPEN', deletedAt: null } },
    select: {
      campaignPrice: true,
      salesCampaign: { select: { slug: true, name: true, salesEndAt: true } }
    },
    take: 1
  }
} satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

/** "Sem juros até N" do produto: 0, 1 ou vazio = só com juros (DT-079). */
export function interestFree(value: number | null | undefined): number | null {
  return value && value >= 2 ? Math.min(value, 12) : null;
}

export function iso(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/**
 * Leitura do catálogo (RF-015, RCF-008): vitrine pública, ficha do produto, lista e ficha da
 * diretoria e categorias. Também gera o endereço (slug) único usado por produtos e categorias
 * (PEN-077).
 */
@Injectable()
export class CatalogReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService
  ) {}

  private async toDetail(
    row: ProductRow,
    options: { admin: boolean; now: Date }
  ): Promise<ProductDetail> {
    const variants = row.variants.filter((variant) => options.admin || variant.isActive);
    const stock = await this.inventory.levels(variants.map((variant) => variant.id));
    const campaign = row.campaignProducts[0] ?? null;
    const tracked = requiresStock(row.fulfillmentType);
    const variantViews: VariantView[] = variants.map((variant) => {
      const level = stock.get(variant.id) ?? { available: 0, reserved: 0, onHand: 0 };
      const price = campaign?.campaignPrice ?? effectiveUnitPrice(row, variant);

      return {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        size: variant.size,
        color: variant.color,
        model: variant.model,
        gender: variant.gender,
        price: moneyView(price, row.currency),
        listPrice: moneyView(listPrice(row, variant), row.currency),
        isActive: variant.isActive,
        minimumStock: variant.minimumStock,
        stock: options.admin ? level : null,
        inStock: !tracked || level.available > 0,
        // Só o aviso de poucas unidades vai ao site, nunca a quantidade (DT-051).
        lowStock: tracked && level.available > 0 && level.available <= LOW_STOCK_THRESHOLD
      };
    });
    const prices = variantViews.map((v) => v.price.amount);
    const lowest =
      prices.length > 0
        ? prices.reduce((min, p) => (money(p).lessThan(money(min)) ? p : min))
        : row.basePrice.toFixed(2);
    const listPrices = variantViews.map((v) => v.listPrice.amount);
    const lowestList =
      listPrices.length > 0
        ? listPrices.reduce((min, p) => (money(p).lessThan(money(min)) ? p : min))
        : row.basePrice.toFixed(2);
    const primary = row.images[0];
    const fields: PersonalizationFieldView[] = row.personalizationFields
      .filter((field) => options.admin || field.isActive)
      .map((field) => ({
        id: field.id,
        label: field.label,
        kind: field.kind,
        required: field.required,
        maxLength: field.maxLength,
        minValue: field.minValue,
        maxValue: field.maxValue,
        uppercase: field.uppercase,
        extraPrice: moneyView(field.extraPrice, row.currency),
        sortOrder: field.sortOrder,
        isActive: field.isActive
      }));
    const partnerVisible =
      row.partner && (options.admin || partnerOperational(row.partner, civilDateOf(options.now)));

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brand: row.brand,
      category: row.category,
      fulfillmentType: row.fulfillmentType,
      status: row.status,
      isFeatured: row.isFeatured,
      priceFrom: { amount: lowest, currency: row.currency },
      listPriceFrom: { amount: lowestList, currency: row.currency },
      image: primary ? { url: mediaUrl(primary.mediaFileId), altText: primary.altText } : null,
      purchasable:
        (isPurchasable(row, options.now) ||
          (row.fulfillmentType === 'CAMPAIGN' && campaign !== null)) &&
        variantViews.some((v) => v.isActive && v.inStock),
      partner:
        partnerVisible && row.partner
          ? {
              id: row.partner.id,
              name: row.partner.displayName,
              logoUrl: row.partner.logoMediaFileId ? mediaUrl(row.partner.logoMediaFileId) : null
            }
          : null,
      campaign: campaign
        ? {
            slug: campaign.salesCampaign.slug,
            name: campaign.salesCampaign.name,
            salesEndAt: campaign.salesCampaign.salesEndAt.toISOString()
          }
        : null,
      description: row.description,
      buyerLimit: row.buyerLimit,
      productionLeadDays: row.productionLeadDays,
      membershipMonths: row.membershipMonths,
      membershipAnnouncedAt: row.membershipAnnouncedAt?.toISOString() ?? null,
      pickupInstructions: row.pickupInstructions,
      sizeGuide: row.sizeGuide,
      interestFreeInstallments: row.interestFreeInstallments,
      personalizationFields: fields,
      isPersonalized: fields.some((field) => field.isActive),
      availableFrom: row.availableFrom?.toISOString() ?? null,
      availableUntil: row.availableUntil?.toISOString() ?? null,
      images: row.images.map((image) => ({
        id: image.id,
        url: mediaUrl(image.mediaFileId),
        altText: image.altText,
        isPrimary: image.isPrimary
      })),
      variants: variantViews,
      ...(options.admin
        ? {
            costPrice: row.costPrice ? moneyView(row.costPrice, row.currency) : null,
            commissionOverride: row.commissionTypeOverride
              ? {
                  type: row.commissionTypeOverride,
                  percentage: row.commissionPercentageOverride?.toFixed(2) ?? null,
                  fixedAmount: row.commissionFixedOverride
                    ? moneyView(row.commissionFixedOverride, row.currency)
                    : null
                }
              : null
          }
        : {})
    };
  }

  /** Vitrine pública: somente produtos ativos e de parceiros aprovados (RN-PAR-001). */
  async publicList(
    query: PageQueryDto & {
      category?: string;
      featured?: boolean;
      campaign?: boolean;
      membership?: boolean;
    }
  ): Promise<Page<ProductSummary>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const now = new Date();
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: { in: ['ACTIVE', 'SOLD_OUT'] },
      fulfillmentType: { not: 'DIGITAL' },
      category: {
        isActive: true,
        deletedAt: null,
        ...(query.category ? { slug: query.category } : {})
      },
      OR: [{ partnerId: null }, { partner: operationalPartnerWhere(civilDateOf(now)) }],
      AND: [
        { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
        { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
        {
          OR: [
            { fulfillmentType: { not: 'CAMPAIGN' } },
            { campaignProducts: { some: { isActive: true, salesCampaign: { status: 'OPEN' } } } }
          ]
        },
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { brand: { contains: search, mode: 'insensitive' as const } }
                ]
              }
            ]
          : [])
      ],
      ...(query.featured ? { isFeatured: true } : {}),
      // Filtro "Pré-venda" da loja (docs/29 COR-012): só produtos em remessa aberta.
      ...(query.campaign
        ? {
            campaignProducts: {
              some: {
                isActive: true,
                deletedAt: null,
                salesCampaign: { status: 'OPEN', deletedAt: null }
              }
            }
          }
        : {}),
      // Bloco "Afiliações abertas" do Início (DT-068).
      ...(query.membership ? { fulfillmentType: 'MEMBERSHIP' as const } : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
        skip,
        take
      }),
      this.prisma.product.count({ where })
    ]);

    return toPage(
      await Promise.all(rows.map((row) => this.toDetail(row, { admin: false, now }))),
      total,
      page,
      pageSize
    );
  }

  async publicDetail(slug: string): Promise<ProductDetail> {
    const now = new Date();
    const row = await this.prisma.product.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: { in: ['ACTIVE', 'SOLD_OUT'] },
        OR: [{ partnerId: null }, { partner: operationalPartnerWhere(civilDateOf(now)) }]
      },
      include: PRODUCT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    return this.toDetail(row, { admin: false, now });
  }

  async adminList(
    query: PageQueryDto & {
      status?: ProductStatus;
      categoryId?: string;
      kind?: 'membership' | 'goods';
    }
  ): Promise<Page<ProductSummary>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
      ...(query.categoryId ? { productCategoryId: query.categoryId } : {}),
      // Planos de afiliação ficam na aba Afiliação; a lista de produtos mostra só mercadorias.
      ...(query.kind === 'membership'
        ? { fulfillmentType: 'MEMBERSHIP' as const }
        : query.kind === 'goods'
          ? { fulfillmentType: { not: 'MEMBERSHIP' as const } }
          : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } }
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { name: 'asc' },
        skip,
        take
      }),
      this.prisma.product.count({ where })
    ]);
    const now = new Date();

    return toPage(
      await Promise.all(rows.map((row) => this.toDetail(row, { admin: true, now }))),
      total,
      page,
      pageSize
    );
  }

  async adminDetail(id: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    return this.toDetail(row, { admin: true, now: new Date() });
  }

  async categories(includeInactive: boolean): Promise<ProductCategoryView[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' }
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isActive: row.isActive
    }));
  }

  async uniqueSlug(kind: 'product' | 'category', name: string): Promise<string> {
    const base = slugify(name) || kind;

    for (let n = 1; n < 200; n += 1) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const exists =
        kind === 'product'
          ? await this.prisma.product.findUnique({ where: { slug }, select: { id: true } })
          : await this.prisma.productCategory.findUnique({ where: { slug }, select: { id: true } });

      if (exists === null) {
        return slug;
      }
    }

    throw AppError.conflict('SLUG_UNAVAILABLE', 'Não foi possível gerar identificador único.');
  }
}
