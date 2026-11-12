import { Injectable } from '@nestjs/common';
import type { CommissionType, ProductStatus } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { DEFAULT_CURRENCY, type Money } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { invalidCommission } from '../../partners/domain/partner-rules';
import { slugify } from '../../sports/domain/sports-rules';
import {
  MEMBERSHIP_CATEGORY,
  ProductDetail,
  ProductInput,
  VariantInput,
  interestFree,
  iso
} from './catalog-view';
import { CatalogReader } from './catalog-view';

/**
 * Produtos da loja (RF-015, RF-035, RCF-007, RCF-008, DT-069): cadastro, afiliação vendida como produto,
 * situação, variações e comissão de parceiro por produto.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reader: CatalogReader
  ) {}

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
          slug: await this.reader.uniqueSlug('category', MEMBERSHIP_CATEGORY)
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
    const slug = await this.reader.uniqueSlug('product', input.name);
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
        interestFreeInstallments: interestFree(input.interestFreeInstallments),
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

    return this.reader.adminDetail(row.id);
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
        ...(input.interestFreeInstallments === undefined
          ? {}
          : { interestFreeInstallments: interestFree(input.interestFreeInstallments) }),
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

    return this.reader.adminDetail(id);
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

    return this.reader.adminDetail(id);
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

    return this.reader.adminDetail(productId);
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

    return this.reader.adminDetail(productId);
  }
}
