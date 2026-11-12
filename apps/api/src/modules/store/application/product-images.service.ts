import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { lockRow } from '../../finance/application/ledger.service';
import { isSameImageSet, MAX_PRODUCT_IMAGES } from '../domain/store-rules';
import { ProductDetail } from './catalog-view';
import { CatalogReader } from './catalog-view';

/**
 * Fotos do produto (RCF-008, DT-039): envio otimizado, ordem, texto alternativo e remoção.
 */
@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly reader: CatalogReader
  ) {}

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

    return this.reader.adminDetail(productId);
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

    return this.reader.adminDetail(productId);
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

    return this.reader.adminDetail(productId);
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

    return this.reader.adminDetail(productId);
  }
}
