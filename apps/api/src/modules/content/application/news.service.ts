import { Injectable } from '@nestjs/common';
import type { NewsStatus, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService,
  mediaUrl
} from '../../media/application/media.service';
import { slugify } from '../../sports/domain/sports-rules';
import {
  NEWS_STATUS_LABELS,
  NEWS_TRANSITIONS,
  newsIsPublic,
  publicationState,
  sanitizeText
} from '../domain/content-rules';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';

export interface NewsCategoryView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly isActive: boolean;
}

export interface NewsSummary {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly category: { id: string; name: string; slug: string };
  readonly coverUrl: string | null;
  readonly isFeatured: boolean;
  readonly showOnHome: boolean;
  readonly showOnForum: boolean;
  readonly publishedAt: string | null;
  readonly event: { id: string; title: string; slug: string; startsAt: string } | null;
}

export interface NewsDetail extends NewsSummary {
  readonly content: string;
  readonly authorName: string | null;
  /** Campos administrativos. */
  readonly status?: NewsStatus;
  readonly scheduledAt?: string | null;
  readonly isPublic?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface NewsInput {
  readonly title: string;
  readonly categoryId: string;
  readonly content: string;
  readonly summary?: string | null;
  readonly slug?: string;
  readonly eventId?: string | null;
  readonly showOnHome?: boolean;
  readonly showOnForum?: boolean;
  readonly isFeatured?: boolean;
}

export interface NewsFilters extends PageQueryDto {
  readonly status?: NewsStatus;
  readonly categoryId?: string;
}

const NEWS_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  event: { select: { id: true, title: true, slug: true, startsAt: true } },
  authorUser: { select: { name: true } }
} satisfies Prisma.NewsInclude;

type NewsRow = Prisma.NewsGetPayload<{ include: typeof NEWS_INCLUDE }>;

/** Filtro público: publicada (ou agendada já alcançada) e não removida (RN-COM-005). */
function publicWhere(now: Date): Prisma.NewsWhereInput {
  return {
    deletedAt: null,
    status: { in: ['PUBLISHED', 'SCHEDULED'] },
    publishedAt: { lte: now },
    category: { isActive: true, deletedAt: null }
  };
}

/** Notícias e comunicados com publicação agendada e canais (RF-041, RF-042, RCF-013, DT-034). */
@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService
  ) {}

  private summary(row: NewsRow): NewsSummary {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      category: row.category,
      coverUrl: row.coverMediaFileId ? mediaUrl(row.coverMediaFileId) : null,
      isFeatured: row.isFeatured,
      showOnHome: row.showOnHome,
      showOnForum: row.showOnForum,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      event: row.event ? { ...row.event, startsAt: row.event.startsAt.toISOString() } : null
    };
  }

  private detail(row: NewsRow, admin: boolean): NewsDetail {
    return {
      ...this.summary(row),
      content: row.content,
      authorName: row.authorUser?.name ?? null,
      ...(admin
        ? {
            status: row.status,
            scheduledAt: row.scheduledAt?.toISOString() ?? null,
            isPublic: newsIsPublic(row, new Date()),
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString()
          }
        : {})
    };
  }

  // ---------- Categorias ----------

  async categories(onlyActive: boolean): Promise<NewsCategoryView[]> {
    const rows = await this.prisma.newsCategory.findMany({
      where: { deletedAt: null, ...(onlyActive ? { isActive: true } : {}) },
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

  private async uniqueSlug(
    model: 'news' | 'category',
    value: string,
    ignoreId?: string
  ): Promise<string> {
    const base = slugify(value) || (model === 'news' ? 'noticia' : 'categoria');
    let slug = base;

    for (let n = 2; ; n += 1) {
      const existing =
        model === 'news'
          ? await this.prisma.news.findUnique({ where: { slug }, select: { id: true } })
          : await this.prisma.newsCategory.findUnique({ where: { slug }, select: { id: true } });

      if (existing === null || existing.id === ignoreId) {
        return slug;
      }

      slug = `${base}-${n}`;
    }
  }

  async createCategory(
    actor: Principal,
    input: { name: string; description?: string },
    meta: RequestMeta
  ): Promise<NewsCategoryView> {
    const row = await this.prisma.newsCategory.create({
      data: {
        name: input.name.trim(),
        slug: await this.uniqueSlug('category', input.name),
        description: input.description ?? null
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.category.created',
      entityType: 'NewsCategory',
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
  ): Promise<NewsCategoryView> {
    const current = await this.prisma.newsCategory.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Categoria não encontrada.');
    }

    const row = await this.prisma.newsCategory.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.category.updated',
      entityType: 'NewsCategory',
      entityId: id,
      before: { name: current.name, isActive: current.isActive },
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

  // ---------- Administração ----------

  private async load(tx: PrismaTx, id: string): Promise<NewsRow> {
    const row = await tx.news.findFirst({ where: { id, deletedAt: null }, include: NEWS_INCLUDE });

    if (row === null) {
      throw AppError.notFound('Notícia não encontrada.');
    }

    return row;
  }

  async list(filters: NewsFilters): Promise<Page<NewsDetail>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const search = filters.search?.trim();
    const where: Prisma.NewsWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        include: NEWS_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take
      }),
      this.prisma.news.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.detail(row, true)),
      total,
      page,
      pageSize
    );
  }

  async get(id: string): Promise<NewsDetail> {
    return this.detail(await this.load(this.prisma, id), true);
  }

  private async assertRefs(input: Partial<NewsInput>): Promise<void> {
    if (input.categoryId) {
      const category = await this.prisma.newsCategory.findFirst({
        where: { id: input.categoryId, deletedAt: null }
      });

      if (category === null) {
        throw AppError.validation('INVALID_CATEGORY', 'Categoria inexistente.');
      }
    }

    if (input.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: input.eventId, deletedAt: null }
      });

      if (event === null) {
        throw AppError.validation('INVALID_EVENT', 'Evento inexistente.');
      }
    }
  }

  private cleanContent(content: string): string {
    const text = sanitizeText(content);

    if (text.length < 10) {
      throw AppError.validation('CONTENT_REQUIRED', 'Escreva o texto da notícia.');
    }

    return text;
  }

  async create(actor: Principal, input: NewsInput, meta: RequestMeta): Promise<NewsDetail> {
    await this.assertRefs(input);

    const row = await this.prisma.news.create({
      data: {
        title: sanitizeText(input.title),
        slug: await this.uniqueSlug('news', input.slug || input.title),
        categoryId: input.categoryId,
        content: this.cleanContent(input.content),
        summary: input.summary ? sanitizeText(input.summary) : null,
        eventId: input.eventId ?? null,
        showOnHome: input.showOnHome ?? false,
        showOnForum: input.showOnForum ?? false,
        isFeatured: input.isFeatured ?? false,
        authorUserId: actor.userId
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.created',
      entityType: 'News',
      entityId: row.id,
      after: { title: row.title, slug: row.slug },
      meta
    });

    return this.get(row.id);
  }

  /** Edição reflete em todos os canais porque há uma única fonte (RF-042). */
  async update(
    actor: Principal,
    id: string,
    input: Partial<NewsInput>,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    const current = await this.load(this.prisma, id);

    if (current.status === 'ARCHIVED') {
      throw AppError.conflict('NEWS_ARCHIVED', 'Notícia arquivada não pode ser editada.');
    }

    await this.assertRefs(input);

    // Slug publicado é estável para não quebrar links compartilhados (RCF-013).
    if (input.slug !== undefined && input.slug !== current.slug && current.publishedAt !== null) {
      throw AppError.conflict(
        'SLUG_LOCKED',
        'O endereço de uma notícia já publicada não pode mudar.'
      );
    }

    await this.prisma.news.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: sanitizeText(input.title) }),
        ...(input.slug === undefined || input.slug === current.slug
          ? {}
          : { slug: await this.uniqueSlug('news', input.slug, id) }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.content === undefined ? {} : { content: this.cleanContent(input.content) }),
        ...(input.summary === undefined
          ? {}
          : { summary: input.summary ? sanitizeText(input.summary) : null }),
        ...(input.eventId === undefined ? {} : { eventId: input.eventId }),
        ...(input.showOnHome === undefined ? {} : { showOnHome: input.showOnHome }),
        ...(input.showOnForum === undefined ? {} : { showOnForum: input.showOnForum }),
        ...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.updated',
      entityType: 'News',
      entityId: id,
      before: { title: current.title, status: current.status },
      after: { fields: Object.keys(input) },
      meta
    });

    return this.get(id);
  }

  /** Publica agora ou agenda para um instante UTC futuro (RN-COM-005). */
  async publish(
    actor: Principal,
    id: string,
    scheduledAt: string | undefined,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    const current = await this.load(this.prisma, id);
    const target = scheduledAt ? new Date(scheduledAt) : null;
    const state = publicationState(target, new Date());

    assertTransition(NEWS_TRANSITIONS, current.status, state.status, NEWS_STATUS_LABELS);

    await this.prisma.news.update({
      where: { id },
      data: { status: state.status, publishedAt: state.publishedAt, scheduledAt: target }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: state.status === 'SCHEDULED' ? 'news.scheduled' : 'news.published',
      entityType: 'News',
      entityId: id,
      before: { status: current.status },
      after: { status: state.status, publishedAt: state.publishedAt.toISOString() },
      meta
    });

    return this.get(id);
  }

  /** Ocultar (com motivo), arquivar ou voltar a rascunho; a retirada vale para todos os canais. */
  async changeStatus(
    actor: Principal,
    id: string,
    status: 'HIDDEN' | 'ARCHIVED' | 'DRAFT',
    reason: string | undefined,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    const current = await this.load(this.prisma, id);

    assertTransition(NEWS_TRANSITIONS, current.status, status, NEWS_STATUS_LABELS);

    if (status === 'HIDDEN' && !reason) {
      throw AppError.validation('REASON_REQUIRED', 'Informe o motivo para ocultar.');
    }

    await this.prisma.news.update({
      where: { id },
      data: { status, ...(status === 'DRAFT' ? { publishedAt: null, scheduledAt: null } : {}) }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'news.status.changed',
      entityType: 'News',
      entityId: id,
      reason: reason ?? null,
      before: { status: current.status },
      after: { status },
      meta
    });

    return this.get(id);
  }

  async setCover(
    actor: Principal,
    id: string,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    const current = await this.load(this.prisma, id);

    await this.prisma.$transaction(async (tx) => {
      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        actor.userId,
        tx
      );

      await tx.news.update({ where: { id }, data: { coverMediaFileId: stored.id } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'news.cover.updated',
          entityType: 'News',
          entityId: id,
          before: { coverMediaFileId: current.coverMediaFileId },
          after: { coverMediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  // ---------- Público ----------

  async publicList(
    query: PageQueryDto & { category?: string; channel?: 'home' | 'forum' }
  ): Promise<Page<NewsSummary>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const now = new Date();
    const where: Prisma.NewsWhereInput = {
      ...publicWhere(now),
      ...(query.category ? { category: { slug: query.category, isActive: true } } : {}),
      ...(query.channel === 'home' ? { showOnHome: true } : {}),
      ...(query.channel === 'forum' ? { showOnForum: true } : {}),
      ...(query.search?.trim()
        ? { title: { contains: query.search.trim(), mode: 'insensitive' } }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        include: NEWS_INCLUDE,
        orderBy:
          query.channel === 'home'
            ? [{ isFeatured: 'desc' }, { publishedAt: 'desc' }]
            : [{ publishedAt: 'desc' }],
        skip,
        take
      }),
      this.prisma.news.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.summary(row)),
      total,
      page,
      pageSize
    );
  }

  async publicGet(slug: string): Promise<NewsDetail> {
    const row = await this.prisma.news.findFirst({
      where: { slug, ...publicWhere(new Date()) },
      include: NEWS_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Notícia não encontrada.');
    }

    return this.detail(row, false);
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
      entityType: 'NewsCategory',
      action: 'news.category.deleted',
      noun: 'a categoria',
      load: (tx) =>
        tx.newsCategory.findFirst({ where: { id, deletedAt: null }, select: { name: true } }),
      usage: async (tx) => [
        {
          count: await tx.news.count({ where: { categoryId: id, deletedAt: null } }),
          label: 'notícia(s)'
        }
      ],
      remove: (tx) =>
        tx.newsCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    });
  }
}
