import { Injectable } from '@nestjs/common';
import type {
  CommissionType,
  Gender,
  Prisma,
  ProductFulfillmentType,
  ProductStatus
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import {
  DEFAULT_CURRENCY,
  type Money,
  money,
  type MoneyView,
  moneyView
} from '../../../common/domain/money';
import { civilDateOf } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService,
  mediaUrl
} from '../../media/application/media.service';
import {
  invalidCommission,
  operationalPartnerWhere,
  partnerOperational
} from '../../partners/domain/partner-rules';
import { slugify } from '../../sports/domain/sports-rules';
import { lockRow } from '../../finance/application/ledger.service';
import {
  effectiveUnitPrice,
  isPurchasable,
  isSameImageSet,
  LOW_STOCK_THRESHOLD,
  listPrice,
  MAX_PRODUCT_IMAGES,
  requiresStock
} from '../domain/store-rules';
import { InventoryService, type StockLevel } from './inventory.service';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';

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

const MEMBERSHIP_CATEGORY = 'Afiliação';

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

const PRODUCT_INCLUDE = {
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

type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

function iso(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** Catálogo da loja (RF-015, RF-035, RCF-007/008). */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly inventory: InventoryService
  ) {}

  // ---------- Personalização (DT-069) ----------

  private async assertProduct(productId: string): Promise<void> {
    const exists = await this.prisma.product.count({ where: { id: productId, deletedAt: null } });

    if (exists === 0) {
      throw AppError.notFound('Produto não encontrado.');
    }
  }

  private validateField(input: Partial<PersonalizationFieldInput>): void {
    if (
      input.minValue !== undefined &&
      input.maxValue !== undefined &&
      input.minValue !== null &&
      input.maxValue !== null &&
      input.minValue > input.maxValue
    ) {
      throw AppError.validation('INVALID_RANGE', 'O mínimo não pode ser maior que o máximo.');
    }
  }

  async createField(
    actor: Principal,
    productId: string,
    input: PersonalizationFieldInput,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    await this.assertProduct(productId);
    this.validateField(input);

    const field = await this.prisma.productPersonalizationField.create({
      data: {
        productId,
        label: input.label.trim(),
        kind: input.kind,
        required: input.required ?? false,
        maxLength: input.kind === 'TEXT' ? (input.maxLength ?? 12) : null,
        minValue: input.kind === 'NUMBER' ? (input.minValue ?? 0) : null,
        maxValue: input.kind === 'NUMBER' ? (input.maxValue ?? 99) : null,
        uppercase: input.kind === 'TEXT' ? (input.uppercase ?? true) : false,
        extraPrice: input.extraPrice ?? 0,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'product.personalization.created',
      entityType: 'Product',
      entityId: productId,
      after: { fieldId: field.id, label: field.label, kind: field.kind },
      meta
    });

    return this.adminDetail(productId);
  }

  async updateField(
    actor: Principal,
    fieldId: string,
    input: Partial<PersonalizationFieldInput>,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const before = await this.prisma.productPersonalizationField.findFirst({
      where: { id: fieldId, deletedAt: null }
    });

    if (before === null) {
      throw AppError.notFound('Campo de personalização não encontrado.');
    }

    this.validateField({
      minValue: input.minValue === undefined ? before.minValue : input.minValue,
      maxValue: input.maxValue === undefined ? before.maxValue : input.maxValue
    });
    await this.prisma.productPersonalizationField.update({
      where: { id: fieldId },
      data: {
        ...(input.label === undefined ? {} : { label: input.label.trim() }),
        ...(input.required === undefined ? {} : { required: input.required }),
        ...(input.maxLength === undefined ? {} : { maxLength: input.maxLength }),
        ...(input.minValue === undefined ? {} : { minValue: input.minValue }),
        ...(input.maxValue === undefined ? {} : { maxValue: input.maxValue }),
        ...(input.uppercase === undefined ? {} : { uppercase: input.uppercase }),
        ...(input.extraPrice === undefined ? {} : { extraPrice: input.extraPrice }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'product.personalization.updated',
      entityType: 'Product',
      entityId: before.productId,
      before: { fieldId, label: before.label, extraPrice: before.extraPrice.toFixed(2) },
      after: {
        ...input,
        ...(input.extraPrice ? { extraPrice: input.extraPrice.toFixed(2) } : {})
      },
      meta
    });

    return this.adminDetail(before.productId);
  }

  /** Exclusão lógica: pedidos já feitos guardam a própria cópia da personalização. */
  async deleteField(
    actor: Principal,
    fieldId: string,
    reason: string,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const before = await this.prisma.productPersonalizationField.findFirst({
      where: { id: fieldId, deletedAt: null }
    });

    if (before === null) {
      throw AppError.notFound('Campo de personalização não encontrado.');
    }

    await this.prisma.productPersonalizationField.update({
      where: { id: fieldId },
      data: { deletedAt: new Date(), isActive: false }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'product.personalization.deleted',
      entityType: 'Product',
      entityId: before.productId,
      reason,
      before: { fieldId, label: before.label },
      meta
    });

    return this.adminDetail(before.productId);
  }

  // ---------- Categorias ----------

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

  private async uniqueSlug(kind: 'product' | 'category', name: string): Promise<string> {
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

  async createCategory(
    actor: Principal,
    input: { name: string; description?: string },
    meta: RequestMeta
  ): Promise<ProductCategoryView> {
    const row = await this.prisma.productCategory.create({
      data: {
        name: input.name.trim(),
        slug: await this.uniqueSlug('category', input.name),
        description: input.description?.trim() || null
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'store.category.created',
      entityType: 'ProductCategory',
      entityId: row.id,
      after: { name: row.name },
      meta
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isActive: row.isActive
    };
  }

  async updateCategory(
    actor: Principal,
    id: string,
    input: { name?: string; description?: string; isActive?: boolean },
    meta: RequestMeta
  ): Promise<ProductCategoryView> {
    const row = await this.prisma.productCategory.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.description === undefined ? {} : { description: input.description || null }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'store.category.updated',
      entityType: 'ProductCategory',
      entityId: id,
      after: input as Record<string, unknown>,
      meta
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isActive: row.isActive
    };
  }

  // ---------- Produtos ----------

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

  private async assertRefs(input: Partial<ProductInput>): Promise<void> {
    if (input.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: input.categoryId, deletedAt: null }
      });

      if (category === null) {
        throw AppError.validation('INVALID_CATEGORY', 'Categoria inexistente.');
      }
    }

    if (input.partnerId) {
      const partner = await this.prisma.partner.findFirst({
        where: { id: input.partnerId, deletedAt: null }
      });

      if (partner === null) {
        throw AppError.validation('INVALID_PARTNER', 'Parceiro inexistente.');
      }
    }

    if (input.commissionTypeOverride) {
      const invalid = invalidCommission({
        type: input.commissionTypeOverride,
        percentage: input.commissionPercentageOverride ?? null,
        fixedAmount: input.commissionFixedOverride ?? null
      });

      if (invalid) {
        throw AppError.validation('INVALID_COMMISSION', invalid);
      }
    }

    if (
      input.fulfillmentType === 'MEMBERSHIP' &&
      (input.membershipMonths === undefined || input.membershipMonths === null)
    ) {
      throw AppError.validation('MONTHS_REQUIRED', 'Informe por quantos meses a afiliação vale.', [
        { field: 'membershipMonths', code: 'REQUIRED', message: 'Informe a validade em meses.' }
      ]);
    }

    if (input.fulfillmentType === 'DIGITAL') {
      throw AppError.validation(
        'DIGITAL_NOT_AVAILABLE',
        'Produto digital ainda não está disponível (fase futura).'
      );
    }

    if (
      input.promotionalPrice &&
      input.basePrice &&
      input.promotionalPrice.greaterThanOrEqualTo(input.basePrice)
    ) {
      throw AppError.validation(
        'INVALID_PROMOTION',
        'O preço promocional deve ser menor que o preço base.'
      );
    }

    if (
      input.availableFrom &&
      input.availableUntil &&
      input.availableFrom >= input.availableUntil
    ) {
      throw AppError.validation(
        'INVALID_WINDOW',
        'O início da disponibilidade deve ser anterior ao fim.'
      );
    }
  }

  /** Regra de comissão própria do produto (PEN-035); `null` volta a usar a do parceiro. */
  private commissionOverrideData(input: Partial<ProductInput>): {
    commissionTypeOverride?: CommissionType | null;
    commissionPercentageOverride?: Money | null;
    commissionFixedOverride?: Money | null;
  } {
    if (input.commissionTypeOverride === undefined) {
      return {};
    }

    const type = input.commissionTypeOverride;

    return {
      commissionTypeOverride: type,
      commissionPercentageOverride:
        type === 'PERCENTAGE' ? (input.commissionPercentageOverride ?? null) : null,
      commissionFixedOverride: type === 'FIXED' ? (input.commissionFixedOverride ?? null) : null
    };
  }

  /**
   * Novo plano de afiliação pela aba Afiliação: é um produto da loja (carrinho, pagamento e
   * estorno iguais), na categoria "Afiliação", criada na primeira vez se não existir.
   */
  async createMembership(
    actor: Principal,
    input: Omit<ProductInput, 'categoryId' | 'fulfillmentType'>,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const existing = await this.prisma.productCategory.findFirst({
      where: { name: MEMBERSHIP_CATEGORY, deletedAt: null },
      select: { id: true }
    });
    const category =
      existing ??
      (await this.prisma.productCategory.create({
        data: {
          name: MEMBERSHIP_CATEGORY,
          slug: await this.uniqueSlug('category', MEMBERSHIP_CATEGORY)
        },
        select: { id: true }
      }));

    return this.create(
      actor,
      { ...input, categoryId: category.id, fulfillmentType: 'MEMBERSHIP' },
      meta
    );
  }

  async create(actor: Principal, input: ProductInput, meta: RequestMeta): Promise<ProductDetail> {
    await this.assertRefs(input);
    const slug = await this.uniqueSlug('product', input.name);
    const row = await this.prisma.product.create({
      data: {
        name: input.name.trim(),
        slug,
        productCategoryId: input.categoryId,
        partnerId: input.partnerId ?? null,
        fulfillmentType: input.fulfillmentType,
        basePrice: input.basePrice,
        promotionalPrice: input.promotionalPrice ?? null,
        costPrice: input.costPrice ?? null,
        currency: DEFAULT_CURRENCY,
        brand: input.brand?.trim() || null,
        description: input.description ?? null,
        buyerLimit: input.buyerLimit ?? null,
        isFeatured: input.isFeatured ?? false,
        availableFrom: iso(input.availableFrom),
        availableUntil: iso(input.availableUntil),
        productionLeadDays: input.productionLeadDays ?? null,
        sizeGuide: input.sizeGuide?.trim() || null,
        membershipMonths:
          input.fulfillmentType === 'MEMBERSHIP' ? (input.membershipMonths ?? null) : null,
        pickupInstructions: input.pickupInstructions ?? null,
        ...this.commissionOverrideData(input),
        status: 'DRAFT',
        // Afiliação tem uma variação só, "Afiliação" (DT-068); os demais começam com "Único".
        variants: {
          create:
            input.fulfillmentType === 'MEMBERSHIP'
              ? { sku: `AFIL-${slug.toUpperCase()}`.slice(0, 100), name: 'Afiliação' }
              : { sku: `${slug.slice(0, 60).toUpperCase()}-UN`, name: 'Único' }
        }
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'store.product.created',
      entityType: 'Product',
      entityId: row.id,
      after: { name: row.name, basePrice: input.basePrice.toFixed(2) },
      meta
    });

    return this.adminDetail(row.id);
  }

  async update(
    actor: Principal,
    id: string,
    input: Partial<ProductInput>,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const before = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    await this.assertRefs({
      ...input,
      ...(input.fulfillmentType === 'MEMBERSHIP' || before.fulfillmentType === 'MEMBERSHIP'
        ? {
            fulfillmentType: input.fulfillmentType ?? before.fulfillmentType,
            membershipMonths:
              input.membershipMonths === undefined
                ? before.membershipMonths
                : input.membershipMonths
          }
        : {}),
      basePrice: input.basePrice ?? before.basePrice,
      ...(input.promotionalPrice === undefined ? {} : { promotionalPrice: input.promotionalPrice })
    });
    await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.categoryId === undefined ? {} : { productCategoryId: input.categoryId }),
        ...(input.partnerId === undefined ? {} : { partnerId: input.partnerId }),
        ...(input.fulfillmentType === undefined ? {} : { fulfillmentType: input.fulfillmentType }),
        ...(input.basePrice === undefined ? {} : { basePrice: input.basePrice }),
        ...(input.promotionalPrice === undefined
          ? {}
          : { promotionalPrice: input.promotionalPrice }),
        ...(input.costPrice === undefined ? {} : { costPrice: input.costPrice }),
        ...(input.brand === undefined ? {} : { brand: input.brand }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.buyerLimit === undefined ? {} : { buyerLimit: input.buyerLimit }),
        ...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured }),
        ...(input.availableFrom === undefined ? {} : { availableFrom: iso(input.availableFrom) }),
        ...(input.availableUntil === undefined
          ? {}
          : { availableUntil: iso(input.availableUntil) }),
        ...(input.productionLeadDays === undefined
          ? {}
          : { productionLeadDays: input.productionLeadDays }),
        ...(input.membershipMonths === undefined
          ? {}
          : { membershipMonths: input.membershipMonths }),
        ...(input.sizeGuide === undefined ? {} : { sizeGuide: input.sizeGuide?.trim() || null }),
        ...(input.pickupInstructions === undefined
          ? {}
          : { pickupInstructions: input.pickupInstructions }),
        ...this.commissionOverrideData(input)
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'store.product.updated',
      entityType: 'Product',
      entityId: id,
      before: {
        name: before.name,
        basePrice: before.basePrice.toFixed(2),
        promotionalPrice: before.promotionalPrice?.toFixed(2) ?? null
      },
      after: {
        ...input,
        ...(input.basePrice ? { basePrice: input.basePrice.toFixed(2) } : {}),
        ...(input.promotionalPrice ? { promotionalPrice: input.promotionalPrice.toFixed(2) } : {}),
        ...(input.costPrice ? { costPrice: input.costPrice.toFixed(2) } : {})
      },
      meta
    });

    return this.adminDetail(id);
  }

  /** "Exclusão" de produto é arquivamento auditado com motivo (RF-024). */
  async setStatus(
    actor: Principal,
    id: string,
    status: ProductStatus,
    reason: string | null,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const before = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { variants: { where: { deletedAt: null, isActive: true } } }
    });

    if (before === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    if (status === 'ACTIVE' && before.variants.length === 0) {
      throw AppError.validation(
        'NO_VARIANTS',
        'Cadastre ao menos uma variação ativa antes de publicar.'
      );
    }

    if (status === 'ARCHIVED' && !reason) {
      throw AppError.validation('REASON_REQUIRED', 'Informe o motivo da exclusão.');
    }

    await this.prisma.product.update({ where: { id }, data: { status } });
    await this.audit.record({
      actorUserId: actor.userId,
      action: status === 'ARCHIVED' ? 'store.product.archived' : 'store.product.status.changed',
      entityType: 'Product',
      entityId: id,
      reason,
      before: { status: before.status },
      after: { status },
      meta
    });

    return this.adminDetail(id);
  }

  async addVariant(
    actor: Principal,
    productId: string,
    input: VariantInput,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { slug: true }
    });

    if (product === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    const sku = (
      input.sku?.trim() || `${product.slug.slice(0, 50)}-${slugify(input.name) || 'var'}`
    ).toUpperCase();
    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku,
        name: input.name.trim(),
        size: input.size ?? null,
        color: input.color ?? null,
        model: input.model?.trim() || null,
        gender: input.gender ?? null,
        priceOverride: input.priceOverride ?? null,
        promotionalPriceOverride: input.promotionalPriceOverride ?? null,
        minimumStock: input.minimumStock ?? 0,
        isActive: input.isActive ?? true
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'store.variant.created',
      entityType: 'ProductVariant',
      entityId: variant.id,
      after: { sku, name: variant.name },
      meta
    });

    return this.adminDetail(productId);
  }

  async updateVariant(
    actor: Principal,
    productId: string,
    variantId: string,
    input: Partial<VariantInput>,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const before = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null }
    });

    if (before === null) {
      throw AppError.notFound('Variação não encontrada.');
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.sku === undefined ? {} : { sku: input.sku.trim().toUpperCase() }),
        ...(input.size === undefined ? {} : { size: input.size }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.model === undefined ? {} : { model: input.model?.trim() || null }),
        ...(input.gender === undefined ? {} : { gender: input.gender }),
        ...(input.priceOverride === undefined ? {} : { priceOverride: input.priceOverride }),
        ...(input.promotionalPriceOverride === undefined
          ? {}
          : { promotionalPriceOverride: input.promotionalPriceOverride }),
        ...(input.minimumStock === undefined ? {} : { minimumStock: input.minimumStock }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'store.variant.updated',
      entityType: 'ProductVariant',
      entityId: variantId,
      before: {
        sku: before.sku,
        priceOverride: before.priceOverride?.toFixed(2) ?? null,
        isActive: before.isActive
      },
      after: {
        ...input,
        ...(input.priceOverride ? { priceOverride: input.priceOverride.toFixed(2) } : {}),
        ...(input.promotionalPriceOverride
          ? { promotionalPriceOverride: input.promotionalPriceOverride.toFixed(2) }
          : {})
      },
      meta
    });

    return this.adminDetail(productId);
  }

  async addImage(
    actor: Principal,
    productId: string,
    file: IncomingFile | undefined,
    altText: string | null,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, deletedAt: null },
        include: { images: { where: { deletedAt: null } } }
      });

      if (product === null) {
        throw AppError.notFound('Produto não encontrado.');
      }

      if (product.images.length >= MAX_PRODUCT_IMAGES) {
        throw AppError.validation(
          'TOO_MANY_IMAGES',
          `Cada produto pode ter até ${MAX_PRODUCT_IMAGES} fotos. Remova uma antes de enviar outra.`
        );
      }

      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        actor.userId,
        tx
      );

      await tx.productImage.create({
        data: {
          productId,
          mediaFileId: stored.id,
          altText,
          sortOrder: product.images.length,
          isPrimary: product.images.length === 0
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'store.image.added',
          entityType: 'Product',
          entityId: productId,
          after: { mediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.adminDetail(productId);
  }

  /** Ordem das fotos; a primeira é a capa (DT-051). */
  async reorderImages(
    actor: Principal,
    productId: string,
    imageIds: readonly string[],
    meta: RequestMeta
  ): Promise<ProductDetail> {
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'product', productId);

      const current = await tx.productImage.findMany({
        where: { productId, deletedAt: null, product: { deletedAt: null } },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { id: true }
      });

      if (current.length === 0) {
        throw AppError.notFound('Produto sem fotos.');
      }

      if (
        !isSameImageSet(
          current.map((image) => image.id),
          imageIds
        )
      ) {
        throw AppError.conflict(
          'IMAGES_CHANGED',
          'As fotos mudaram enquanto você reorganizava. Recarregue a página e tente de novo.'
        );
      }

      for (const [index, id] of imageIds.entries()) {
        await tx.productImage.update({
          where: { id },
          data: { sortOrder: index, isPrimary: index === 0 }
        });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'store.image.reordered',
          entityType: 'Product',
          entityId: productId,
          before: { order: current.map((image) => image.id) },
          after: { order: imageIds },
          meta
        },
        tx
      );
    });

    return this.adminDetail(productId);
  }

  async updateImageAlt(
    actor: Principal,
    productId: string,
    imageId: string,
    altText: string | null,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId, deletedAt: null }
    });

    if (image === null) {
      throw AppError.notFound('Imagem não encontrada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.update({ where: { id: imageId }, data: { altText } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'store.image.updated',
          entityType: 'Product',
          entityId: productId,
          before: { altText: image.altText },
          after: { altText },
          meta
        },
        tx
      );
    });

    return this.adminDetail(productId);
  }

  async removeImage(
    actor: Principal,
    productId: string,
    imageId: string,
    meta: RequestMeta
  ): Promise<ProductDetail> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId, deletedAt: null }
    });

    if (image === null) {
      throw AppError.notFound('Imagem não encontrada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.update({
        where: { id: imageId },
        data: { deletedAt: new Date(), isPrimary: false }
      });

      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId, deletedAt: null },
          orderBy: { sortOrder: 'asc' }
        });

        if (next) {
          await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'store.image.removed',
          entityType: 'Product',
          entityId: productId,
          after: { imageId },
          meta
        },
        tx
      );
    });

    return this.adminDetail(productId);
  }

  /** Exclusão lógica só sem uso (docs/29 COR-022); em uso, a resposta sugere inativar. */
  async deleteCategory(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<void> {
    await softDeleteIfUnused({
      prisma: this.prisma,
      audit: this.audit,
      actor,
      meta,
      reason,
      entityId: id,
      entityType: 'ProductCategory',
      action: 'store.category.deleted',
      noun: 'a categoria',
      load: (tx) =>
        tx.productCategory.findFirst({ where: { id, deletedAt: null }, select: { name: true } }),
      usage: async (tx) => [
        {
          count: await tx.product.count({ where: { productCategoryId: id, deletedAt: null } }),
          label: 'produto(s)'
        },
        {
          count: await tx.productCategory.count({ where: { parentId: id, deletedAt: null } }),
          label: 'subcategoria(s)'
        }
      ],
      remove: (tx) =>
        tx.productCategory.update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false }
        })
    });
  }
}
