import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PersonalizationFieldInput, ProductDetail } from './catalog-view';
import { CatalogReader } from './catalog-view';

/**
 * Campos de personalização do produto (DT-069): o que o comprador preenche (nome, número,
 * tamanho) e as regras de cada campo.
 */
@Injectable()
export class ProductFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reader: CatalogReader
  ) {}

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

    return this.reader.adminDetail(productId);
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

    return this.reader.adminDetail(before.productId);
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

    return this.reader.adminDetail(before.productId);
  }
}
