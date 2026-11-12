import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';
import { ProductCategoryView } from './catalog-view';
import { CatalogReader } from './catalog-view';

/**
 * Categorias da loja (RF-015): criação, edição e exclusão lógica, com auditoria.
 */
@Injectable()
export class CatalogCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reader: CatalogReader
  ) {}

  async createCategory(
    actor: Principal,
    input: { name: string; description?: string },
    meta: RequestMeta
  ): Promise<ProductCategoryView> {
    const row = await this.prisma.productCategory.create({
      data: {
        name: input.name.trim(),
        slug: await this.reader.uniqueSlug('category', input.name),
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
