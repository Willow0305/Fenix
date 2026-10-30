import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { slugify } from '../../sports/domain/sports-rules';
import { sanitizeText } from '../domain/content-rules';

export interface NewsTagView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isActive: boolean;
  /** Notícias que usam o assunto (só no painel). */
  readonly newsCount?: number;
}

/** No máximo 5 assuntos por notícia, para o assunto continuar dizendo algo. */
export const MAX_TAGS_PER_NEWS = 5;

/**
 * Assuntos de notícias em lista controlada pela diretoria (D8, DT-081): quem escreve escolhe
 * da lista; só quem gerencia notícias cria, renomeia, inativa ou exclui.
 */
@Injectable()
export class NewsTagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(onlyActive: boolean): Promise<NewsTagView[]> {
    const rows = await this.prisma.newsTag.findMany({
      where: { deletedAt: null, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { name: 'asc' },
      include: { _count: { select: { news: true } } }
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      ...(onlyActive ? {} : { newsCount: row._count.news })
    }));
  }

  private async uniqueSlug(name: string, ignoreId?: string): Promise<string> {
    const base = slugify(name) || 'assunto';
    let slug = base;

    for (let n = 2; ; n += 1) {
      const existing = await this.prisma.newsTag.findUnique({ where: { slug } });

      if (existing === null || existing.id === ignoreId) {
        return slug;
      }

      slug = `${base}-${n}`;
    }
  }

  private async assertNameFree(name: string, ignoreId?: string): Promise<void> {
    const same = await this.prisma.newsTag.findFirst({
      where: {
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(ignoreId ? { id: { not: ignoreId } } : {})
      },
      select: { id: true }
    });

    if (same !== null) {
      throw AppError.conflict('TAG_EXISTS', `Já existe o assunto "${name}".`);
    }
  }

  async create(actor: Principal, input: { name: string }, meta: RequestMeta): Promise<NewsTagView> {
    const name = sanitizeText(input.name);

    await this.assertNameFree(name);

    const row = await this.prisma.newsTag.create({
      data: { name, slug: await this.uniqueSlug(name) }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.tag.created',
      entityType: 'NewsTag',
      entityId: row.id,
      after: { name },
      meta
    });

    return { id: row.id, name: row.name, slug: row.slug, isActive: row.isActive, newsCount: 0 };
  }

  /** Renomear mantém o endereço do assunto, para não quebrar links já compartilhados. */
  async update(
    actor: Principal,
    id: string,
    input: { name?: string; isActive?: boolean },
    meta: RequestMeta
  ): Promise<NewsTagView> {
    const current = await this.prisma.newsTag.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Assunto não encontrado.');
    }

    const name = input.name === undefined ? undefined : sanitizeText(input.name);

    if (name !== undefined) {
      await this.assertNameFree(name, id);
    }

    const row = await this.prisma.newsTag.update({
      where: { id },
      data: {
        ...(name === undefined ? {} : { name }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      },
      include: { _count: { select: { news: true } } }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.tag.updated',
      entityType: 'NewsTag',
      entityId: id,
      before: { name: current.name, isActive: current.isActive },
      after: { name: row.name, isActive: row.isActive },
      meta
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      newsCount: row._count.news
    };
  }

  /** Exclusão lógica só sem uso, como as categorias (docs/29 COR-022); em uso, inative. */
  async remove(actor: Principal, id: string, reason: string, meta: RequestMeta): Promise<void> {
    await softDeleteIfUnused({
      prisma: this.prisma,
      audit: this.audit,
      actor,
      meta,
      reason,
      entityId: id,
      entityType: 'NewsTag',
      action: 'news.tag.deleted',
      noun: 'o assunto',
      load: (tx) =>
        tx.newsTag.findFirst({ where: { id, deletedAt: null }, select: { name: true } }),
      usage: async (tx) => [
        {
          count: await tx.newsTagLink.count({ where: { tagId: id, news: { deletedAt: null } } }),
          label: 'notícia(s)'
        }
      ],
      remove: (tx) =>
        tx.newsTag.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    });
  }

  /** Troca os assuntos da notícia pelos escolhidos (todos ativos e da lista). */
  async assign(tx: PrismaTx, newsId: string, tagIds: readonly string[]): Promise<void> {
    const unique = [...new Set(tagIds)];

    if (unique.length > MAX_TAGS_PER_NEWS) {
      throw AppError.validation(
        'TOO_MANY_TAGS',
        `Escolha até ${MAX_TAGS_PER_NEWS} assuntos por notícia.`
      );
    }

    const found = await tx.newsTag.count({
      where: { id: { in: unique }, deletedAt: null, isActive: true }
    });

    if (found !== unique.length) {
      throw AppError.validation('INVALID_TAG', 'Escolha os assuntos da lista da diretoria.');
    }

    await tx.newsTagLink.deleteMany({ where: { newsId, tagId: { notIn: unique } } });
    await tx.newsTagLink.createMany({
      data: unique.map((tagId) => ({ newsId, tagId })),
      skipDuplicates: true
    });
  }
}
