import { Injectable } from '@nestjs/common';
import type {
  ForumPostStatus,
  ForumReactionType,
  ForumReportStatus,
  ForumTopicStatus,
  ForumVisibility,
  ModerationActionType,
  Prisma
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { slugify } from '../../sports/domain/sports-rules';
import {
  ANONYMOUS,
  authorCanEdit,
  canRead,
  type ForumViewer,
  POST_RATE,
  rateExceeded,
  readableVisibilities,
  REPORT_RATE,
  sanitizeText,
  TOPIC_RATE,
  visibleTopicStatuses
} from '../domain/content-rules';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';

export interface ForumCategoryView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly visibility: ForumVisibility;
  readonly isActive: boolean;
  readonly topicCount: number;
  readonly canPost: boolean;
}

export interface TopicSummary {
  readonly id: string;
  readonly title: string;
  readonly status: ForumTopicStatus;
  readonly visibility: ForumVisibility;
  readonly isPinned: boolean;
  readonly author: string | null;
  readonly postCount: number;
  readonly lastActivityAt: string;
  readonly createdAt: string;
}

export interface PostView {
  readonly id: string;
  readonly author: { id: string; name: string } | null;
  readonly parentPostId: string | null;
  /** `null` quando removida ou oculta para quem não modera. */
  readonly content: string | null;
  readonly status: ForumPostStatus;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly reactions: Record<ForumReactionType, number>;
  readonly myReaction: ForumReactionType | null;
  readonly canEdit: boolean;
}

export interface TopicDetail extends TopicSummary {
  readonly category: { id: string; name: string; slug: string };
  readonly posts: Page<PostView>;
  readonly canReply: boolean;
  readonly canModerate: boolean;
}

export interface ReportView {
  readonly id: string;
  readonly target: 'TOPIC' | 'POST';
  readonly topicId: string | null;
  readonly postId: string | null;
  readonly topicTitle: string | null;
  readonly excerpt: string | null;
  readonly reason: string;
  readonly details: string | null;
  readonly status: ForumReportStatus;
  readonly reporter: string;
  readonly resolution: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}

export interface ModerationView {
  readonly id: string;
  readonly action: ModerationActionType;
  readonly topicId: string | null;
  readonly postId: string | null;
  readonly moderator: string;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly createdAt: string;
}

export type TopicModeration = 'HIDE' | 'RESTORE' | 'CLOSE' | 'REOPEN' | 'PIN' | 'UNPIN';
export type PostModeration = 'HIDE' | 'RESTORE' | 'DELETE';

const EMPTY_REACTIONS: Record<ForumReactionType, number> = { LIKE: 0, SUPPORT: 0, CELEBRATE: 0 };

/** Fórum moderado (RF-040, RF-043, RCF-012, RN-COM-001 a 003, PEN-039, DT-034). */
@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  viewer(principal: Principal | undefined): ForumViewer {
    if (principal === undefined) {
      return ANONYMOUS;
    }

    return {
      authenticated: true,
      member: principal.permissions.has(PERMISSIONS.forumMembersAccess),
      staff: principal.permissions.has(PERMISSIONS.forumModerate)
    };
  }

  /** Mensagens que o leitor vê na contagem e na lista (moderação vê ocultas). */
  private visiblePostStatuses(viewer: ForumViewer): ForumPostStatus[] {
    return viewer.staff ? ['PUBLISHED', 'HIDDEN', 'DELETED'] : ['PUBLISHED', 'DELETED'];
  }

  private topicWhere(viewer: ForumViewer): Prisma.ForumTopicWhereInput {
    return {
      deletedAt: null,
      status: { in: visibleTopicStatuses(viewer) },
      visibility: { in: readableVisibilities(viewer) },
      category: { deletedAt: null, visibility: { in: readableVisibilities(viewer) } }
    };
  }

  // ---------- Categorias ----------

  async categories(principal: Principal | undefined, includeInactive = false) {
    const viewer = this.viewer(principal);
    const rows = await this.prisma.forumCategory.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive && viewer.staff ? {} : { isActive: true }),
        visibility: { in: readableVisibilities(viewer) }
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { topics: { where: this.topicWhere(viewer) } } }
      }
    });

    return rows.map<ForumCategoryView>((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      visibility: row.visibility,
      isActive: row.isActive,
      topicCount: row._count.topics,
      canPost: viewer.authenticated && row.isActive && (row.visibility !== 'STAFF' || viewer.staff)
    }));
  }

  async createCategory(
    actor: Principal,
    input: { name: string; description?: string; visibility: ForumVisibility },
    meta: RequestMeta
  ): Promise<ForumCategoryView> {
    const base = slugify(input.name) || 'categoria';
    let slug = base;

    for (
      let n = 2;
      await this.prisma.forumCategory.findUnique({ where: { slug }, select: { id: true } });
      n += 1
    ) {
      slug = `${base}-${n}`;
    }

    const row = await this.prisma.forumCategory.create({
      data: {
        name: sanitizeText(input.name),
        slug,
        description: input.description ? sanitizeText(input.description) : null,
        visibility: input.visibility
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'forum.category.created',
      entityType: 'ForumCategory',
      entityId: row.id,
      after: { name: row.name, visibility: row.visibility },
      meta
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      visibility: row.visibility,
      isActive: row.isActive,
      topicCount: 0,
      canPost: true
    };
  }

  /** Mudar a visibilidade da categoria propaga aos tópicos, sem abrir conteúdo mais restrito. */
  async updateCategory(
    actor: Principal,
    id: string,
    input: {
      name?: string;
      description?: string;
      visibility?: ForumVisibility;
      isActive?: boolean;
    },
    meta: RequestMeta
  ): Promise<void> {
    const current = await this.prisma.forumCategory.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Categoria não encontrada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.forumCategory.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: sanitizeText(input.name) }),
          ...(input.description === undefined
            ? {}
            : { description: sanitizeText(input.description) || null }),
          ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive })
        }
      });

      if (input.visibility && input.visibility !== current.visibility) {
        await tx.forumTopic.updateMany({
          where: { categoryId: id },
          data: { visibility: input.visibility }
        });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'forum.category.updated',
          entityType: 'ForumCategory',
          entityId: id,
          before: { visibility: current.visibility, isActive: current.isActive },
          after: input as Record<string, unknown>,
          meta
        },
        tx
      );
    });
  }

  private async readableCategory(slug: string, viewer: ForumViewer) {
    const category = await this.prisma.forumCategory.findFirst({
      where: { slug, deletedAt: null, ...(viewer.staff ? {} : { isActive: true }) }
    });

    // 404 também para conteúdo restrito: não revela a existência (RN-COM-001).
    if (category === null || !canRead(category.visibility, viewer)) {
      throw AppError.notFound('Categoria não encontrada.');
    }

    return category;
  }

  // ---------- Tópicos ----------

  async topics(
    slug: string,
    principal: Principal | undefined,
    query: PageQueryDto
  ): Promise<{ category: ForumCategoryView; topics: Page<TopicSummary> }> {
    const viewer = this.viewer(principal);
    const category = await this.readableCategory(slug, viewer);
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.ForumTopicWhereInput = {
      ...this.topicWhere(viewer),
      categoryId: category.id
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.forumTopic.findMany({
        where,
        include: {
          authorUser: { select: { name: true } },
          _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
          posts: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } }
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take
      }),
      this.prisma.forumTopic.count({ where })
    ]);

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        visibility: category.visibility,
        isActive: category.isActive,
        topicCount: total,
        canPost:
          viewer.authenticated &&
          category.isActive &&
          (category.visibility !== 'STAFF' || viewer.staff)
      },
      topics: toPage(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          visibility: row.visibility,
          isPinned: row.isPinned,
          author: row.authorUser?.name ?? null,
          postCount: row._count.posts,
          lastActivityAt: (row.posts[0]?.createdAt ?? row.createdAt).toISOString(),
          createdAt: row.createdAt.toISOString()
        })),
        total,
        page,
        pageSize
      )
    };
  }

  private async assertRate(
    tx: PrismaTx,
    kind: 'post' | 'topic' | 'report',
    userId: string
  ): Promise<void> {
    const config = kind === 'post' ? POST_RATE : kind === 'topic' ? TOPIC_RATE : REPORT_RATE;
    const since = new Date(Date.now() - config.windowMs);
    const recentCount =
      kind === 'post'
        ? await tx.forumPost.count({ where: { authorUserId: userId, createdAt: { gte: since } } })
        : kind === 'topic'
          ? await tx.forumTopic.count({
              where: { authorUserId: userId, createdAt: { gte: since } }
            })
          : await tx.forumReport.count({
              where: { reporterUserId: userId, createdAt: { gte: since } }
            });

    if (rateExceeded({ recentCount, limit: config.limit })) {
      throw new AppError(
        'TOO_MANY_REQUESTS',
        'RATE_LIMITED',
        'Você publicou muitas vezes em pouco tempo. Aguarde alguns minutos.'
      );
    }
  }

  private cleanContent(content: string, field = 'content'): string {
    const text = sanitizeText(content);

    if (text.length < 2) {
      throw AppError.validation('CONTENT_REQUIRED', 'Escreva a mensagem.', [
        { field, code: 'REQUIRED', message: 'Escreva a mensagem.' }
      ]);
    }

    return text;
  }

  async createTopic(
    principal: Principal,
    slug: string,
    input: { title: string; content: string; pinned?: boolean },
    meta: RequestMeta
  ): Promise<TopicDetail> {
    const viewer = this.viewer(principal);
    const category = await this.readableCategory(slug, viewer);

    if (!category.isActive || (category.visibility === 'STAFF' && !viewer.staff)) {
      throw AppError.forbidden('Você não pode publicar nesta categoria.');
    }

    const pinned = input.pinned === true;

    if (pinned && !principal.permissions.has(PERMISSIONS.forumPublish)) {
      throw AppError.forbidden('Somente a diretoria publica comunicados fixados.');
    }

    const title = sanitizeText(input.title);

    if (title.length < 3) {
      throw AppError.validation('TITLE_REQUIRED', 'Informe um título.');
    }

    const id = await this.prisma.$transaction(async (tx) => {
      await this.assertRate(tx, 'topic', principal.userId);

      const topic = await tx.forumTopic.create({
        data: {
          categoryId: category.id,
          authorUserId: principal.userId,
          title,
          visibility: category.visibility,
          status: 'PUBLISHED',
          isPinned: pinned,
          pinnedAt: pinned ? new Date() : null
        }
      });

      await tx.forumPost.create({
        data: {
          topicId: topic.id,
          authorUserId: principal.userId,
          content: this.cleanContent(input.content)
        }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'forum.topic.created',
          entityType: 'ForumTopic',
          entityId: topic.id,
          after: { categoryId: category.id, pinned },
          meta
        },
        tx
      );

      return topic.id;
    });

    return this.topic(id, principal, {});
  }

  private async readableTopic(id: string, viewer: ForumViewer) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id, ...this.topicWhere(viewer) },
      include: {
        category: { select: { id: true, name: true, slug: true, isActive: true } },
        authorUser: { select: { name: true } }
      }
    });

    if (topic === null) {
      throw AppError.notFound('Tópico não encontrado.');
    }

    return topic;
  }

  async topic(
    id: string,
    principal: Principal | undefined,
    query: PageQueryDto
  ): Promise<TopicDetail> {
    const viewer = this.viewer(principal);
    const topic = await this.readableTopic(id, viewer);
    const { skip, take, page, pageSize } = pageArgs({ ...query, pageSize: query.pageSize ?? 50 });
    const where: Prisma.ForumPostWhereInput = {
      topicId: id,
      status: { in: this.visiblePostStatuses(viewer) }
    };
    const [rows, total, published] = await this.prisma.$transaction([
      this.prisma.forumPost.findMany({
        where,
        include: {
          authorUser: { select: { id: true, name: true } },
          reactions: { select: { type: true, userId: true } }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take
      }),
      this.prisma.forumPost.count({ where }),
      this.prisma.forumPost.count({ where: { topicId: id, status: 'PUBLISHED' } })
    ]);
    const now = new Date();

    return {
      id: topic.id,
      title: topic.title,
      status: topic.status,
      visibility: topic.visibility,
      isPinned: topic.isPinned,
      author: topic.authorUser?.name ?? null,
      postCount: published,
      lastActivityAt: (rows[rows.length - 1]?.createdAt ?? topic.createdAt).toISOString(),
      createdAt: topic.createdAt.toISOString(),
      category: { id: topic.category.id, name: topic.category.name, slug: topic.category.slug },
      canReply: viewer.authenticated && topic.status === 'PUBLISHED' && topic.category.isActive,
      canModerate: viewer.staff,
      posts: toPage(
        rows.map((post) => {
          const reactions = { ...EMPTY_REACTIONS };

          for (const reaction of post.reactions) {
            reactions[reaction.type] += 1;
          }

          const own = principal !== undefined && post.authorUserId === principal.userId;
          const showContent =
            post.status === 'PUBLISHED' || (post.status === 'HIDDEN' && viewer.staff);

          return {
            id: post.id,
            author: post.authorUser,
            parentPostId: post.parentPostId,
            content: showContent ? post.content : null,
            status: post.status,
            editedAt: post.editedAt?.toISOString() ?? null,
            createdAt: post.createdAt.toISOString(),
            reactions,
            myReaction: principal
              ? (post.reactions.find((r) => r.userId === principal.userId)?.type ?? null)
              : null,
            canEdit: own && post.status === 'PUBLISHED' && authorCanEdit(post.createdAt, now)
          };
        }),
        total,
        page,
        pageSize
      )
    };
  }

  // ---------- Mensagens ----------

  async reply(
    principal: Principal,
    topicId: string,
    input: { content: string; parentPostId?: string },
    meta: RequestMeta
  ): Promise<PostView> {
    const viewer = this.viewer(principal);
    const topic = await this.readableTopic(topicId, viewer);

    if (topic.status !== 'PUBLISHED' || !topic.category.isActive) {
      throw AppError.conflict('TOPIC_CLOSED', 'Este tópico não aceita novas mensagens.');
    }

    if (input.parentPostId) {
      const parent = await this.prisma.forumPost.findFirst({
        where: { id: input.parentPostId, topicId, status: 'PUBLISHED' }
      });

      if (parent === null) {
        throw AppError.validation('INVALID_PARENT', 'Mensagem respondida não encontrada.');
      }
    }

    const post = await this.prisma.$transaction(async (tx) => {
      await this.assertRate(tx, 'post', principal.userId);

      const created = await tx.forumPost.create({
        data: {
          topicId,
          authorUserId: principal.userId,
          parentPostId: input.parentPostId ?? null,
          content: this.cleanContent(input.content)
        }
      });

      // Tópico com atividade recente sobe na lista.
      await tx.forumTopic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'forum.post.created',
          entityType: 'ForumPost',
          entityId: created.id,
          after: { topicId },
          meta
        },
        tx
      );

      if (topic.authorUserId && topic.authorUserId !== principal.userId) {
        await this.notifications.notify(
          {
            userId: topic.authorUserId,
            type: 'forum.reply',
            title: 'Nova resposta no seu tópico',
            message: `${principal.name} respondeu em "${topic.title}".`,
            link: `/forum/topicos/${topicId}`,
            deduplicationKey: `forum-reply:${created.id}`
          },
          tx
        );
      }

      return created;
    });

    return this.postView(post.id, principal);
  }

  private async postView(id: string, principal: Principal): Promise<PostView> {
    const post = await this.prisma.forumPost.findUniqueOrThrow({
      where: { id },
      include: {
        authorUser: { select: { id: true, name: true } },
        reactions: { select: { type: true, userId: true } }
      }
    });
    const reactions = { ...EMPTY_REACTIONS };

    for (const reaction of post.reactions) {
      reactions[reaction.type] += 1;
    }

    return {
      id: post.id,
      author: post.authorUser,
      parentPostId: post.parentPostId,
      content: post.status === 'PUBLISHED' ? post.content : null,
      status: post.status,
      editedAt: post.editedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      reactions,
      myReaction: post.reactions.find((r) => r.userId === principal.userId)?.type ?? null,
      canEdit:
        post.authorUserId === principal.userId &&
        post.status === 'PUBLISHED' &&
        authorCanEdit(post.createdAt, new Date())
    };
  }

  /** Mensagem legível pelo usuário (tópico visível); usada por edição, reação e denúncia. */
  private async readablePost(id: string, viewer: ForumViewer) {
    const post = await this.prisma.forumPost.findFirst({
      where: { id, topic: this.topicWhere(viewer) },
      include: { topic: { select: { id: true, title: true, status: true } } }
    });

    if (post === null) {
      throw AppError.notFound('Mensagem não encontrada.');
    }

    return post;
  }

  /** O autor edita em até 24 h; o texto anterior fica na auditoria. */
  async editOwn(
    principal: Principal,
    id: string,
    content: string,
    meta: RequestMeta
  ): Promise<PostView> {
    const post = await this.readablePost(id, this.viewer(principal));

    if (post.authorUserId !== principal.userId) {
      throw AppError.forbidden('Você só pode editar suas mensagens.');
    }

    if (post.status !== 'PUBLISHED' || !authorCanEdit(post.createdAt, new Date())) {
      throw AppError.conflict('EDIT_WINDOW_CLOSED', 'Esta mensagem não pode mais ser editada.');
    }

    const text = this.cleanContent(content);

    await this.prisma.$transaction(async (tx) => {
      await tx.forumPost.update({ where: { id }, data: { content: text, editedAt: new Date() } });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'forum.post.edited',
          entityType: 'ForumPost',
          entityId: id,
          before: { content: post.content },
          after: { content: text },
          meta
        },
        tx
      );
    });

    return this.postView(id, principal);
  }

  /** Remoção pelo autor: exclusão lógica; o texto deixa de aparecer, o registro fica. */
  async deleteOwn(principal: Principal, id: string, meta: RequestMeta): Promise<void> {
    const post = await this.readablePost(id, this.viewer(principal));

    if (post.authorUserId !== principal.userId) {
      throw AppError.forbidden('Você só pode remover suas mensagens.');
    }

    if (post.status !== 'PUBLISHED') {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.forumPost.update({
        where: { id },
        data: { status: 'DELETED', deletedAt: new Date() }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'forum.post.deleted_by_author',
          entityType: 'ForumPost',
          entityId: id,
          before: { status: post.status },
          after: { status: 'DELETED' },
          meta
        },
        tx
      );
    });
  }

  /** Reação idempotente: uma por pessoa e mensagem; repetir o mesmo tipo não duplica. */
  async react(principal: Principal, id: string, type: ForumReactionType | null): Promise<PostView> {
    const post = await this.readablePost(id, this.viewer(principal));

    if (post.status !== 'PUBLISHED') {
      throw AppError.conflict('POST_UNAVAILABLE', 'Mensagem indisponível.');
    }

    if (type === null) {
      await this.prisma.forumReaction.deleteMany({
        where: { postId: id, userId: principal.userId }
      });
    } else {
      await this.prisma.forumReaction.upsert({
        where: { postId_userId: { postId: id, userId: principal.userId } },
        create: { postId: id, userId: principal.userId, type },
        update: { type }
      });
    }

    return this.postView(id, principal);
  }

  /** Denúncia restrita à moderação; repetir sobre o mesmo alvo devolve a denúncia aberta. */
  async report(
    principal: Principal,
    input: { postId?: string; topicId?: string; reason: string; details?: string },
    meta: RequestMeta
  ): Promise<{ id: string; status: ForumReportStatus }> {
    const viewer = this.viewer(principal);

    if (Boolean(input.postId) === Boolean(input.topicId)) {
      throw AppError.validation('TARGET_REQUIRED', 'Informe a mensagem ou o tópico denunciado.');
    }

    if (input.postId) {
      await this.readablePost(input.postId, viewer);
    } else {
      await this.readableTopic(input.topicId as string, viewer);
    }

    const target = input.postId ? { postId: input.postId } : { topicId: input.topicId as string };
    const existing = await this.prisma.forumReport.findFirst({
      where: {
        ...target,
        reporterUserId: principal.userId,
        status: { in: ['OPEN', 'UNDER_REVIEW'] }
      },
      select: { id: true, status: true }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertRate(tx, 'report', principal.userId);

      const created = await tx.forumReport.create({
        data: {
          ...target,
          reporterUserId: principal.userId,
          reason: sanitizeText(input.reason).slice(0, 180),
          details: input.details ? sanitizeText(input.details) : null
        },
        select: { id: true, status: true }
      });

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'forum.report.created',
          entityType: 'ForumReport',
          entityId: created.id,
          after: target,
          meta
        },
        tx
      );

      const moderators = await this.notifications.permissionHolders(PERMISSIONS.forumModerate, tx);

      await this.notifications.notify(
        moderators.map((userId) => ({
          userId,
          type: 'forum.report',
          title: 'Nova denúncia no fórum',
          message: 'Há conteúdo aguardando análise da moderação.',
          link: '/admin/forum',
          deduplicationKey: `forum-report:${created.id}:${userId}`
        })),
        tx
      );

      return created;
    });
  }

  // ---------- Moderação ----------

  private async record(
    tx: PrismaTx,
    actor: Principal,
    entry: {
      topicId?: string;
      postId?: string;
      action: ModerationActionType;
      reason: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    },
    meta: RequestMeta
  ): Promise<string> {
    const created = await tx.forumModerationAction.create({
      data: {
        topicId: entry.topicId ?? null,
        postId: entry.postId ?? null,
        moderatorUserId: actor.userId,
        action: entry.action,
        reason: entry.reason,
        beforeData: entry.before as Prisma.InputJsonValue,
        afterData: entry.after as Prisma.InputJsonValue
      },
      select: { id: true }
    });
    await this.audit.record(
      {
        actorUserId: actor.userId,
        action: `forum.moderation.${entry.action.toLowerCase()}`,
        entityType: entry.postId ? 'ForumPost' : 'ForumTopic',
        entityId: entry.postId ?? entry.topicId ?? null,
        reason: entry.reason,
        before: entry.before,
        after: entry.after,
        meta
      },
      tx
    );

    return created.id;
  }

  /** Ocultar, restaurar, fechar, reabrir e fixar tópico, sempre com motivo (RN-COM-003). */
  async moderateTopic(
    actor: Principal,
    id: string,
    action: TopicModeration,
    reason: string,
    meta: RequestMeta
  ): Promise<void> {
    const topic = await this.prisma.forumTopic.findFirst({ where: { id, deletedAt: null } });

    if (topic === null) {
      throw AppError.notFound('Tópico não encontrado.');
    }

    const rules: Record<
      TopicModeration,
      {
        from: ForumTopicStatus[] | null;
        data: Prisma.ForumTopicUpdateInput;
        type: ModerationActionType;
      }
    > = {
      HIDE: { from: ['PUBLISHED', 'CLOSED'], data: { status: 'HIDDEN' }, type: 'HIDE' },
      RESTORE: { from: ['HIDDEN'], data: { status: 'PUBLISHED' }, type: 'RESTORE' },
      CLOSE: {
        from: ['PUBLISHED'],
        data: { status: 'CLOSED', closedAt: new Date() },
        type: 'CLOSE'
      },
      REOPEN: { from: ['CLOSED'], data: { status: 'PUBLISHED', closedAt: null }, type: 'REOPEN' },
      PIN: { from: null, data: { isPinned: true, pinnedAt: new Date() }, type: 'EDIT' },
      UNPIN: { from: null, data: { isPinned: false, pinnedAt: null }, type: 'EDIT' }
    };
    const rule = rules[action];

    if (rule.from !== null && !rule.from.includes(topic.status)) {
      throw AppError.conflict('INVALID_TRANSITION', 'Ação incompatível com a situação do tópico.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.forumTopic.update({ where: { id }, data: rule.data });
      const actionId = await this.record(
        tx,
        actor,
        {
          topicId: id,
          action: rule.type,
          reason,
          before: { status: topic.status, isPinned: topic.isPinned },
          after: { action, ...(rule.data as Record<string, unknown>) }
        },
        meta
      );

      if (action === 'HIDE' && topic.authorUserId) {
        await this.notifications.notify(
          {
            userId: topic.authorUserId,
            type: 'forum.moderation',
            title: 'Seu tópico foi ocultado pela moderação',
            message: `"${topic.title}": ${reason}`,
            deduplicationKey: `forum-moderation:${actionId}`
          },
          tx
        );
      }
    });
  }

  async moderatePost(
    actor: Principal,
    id: string,
    action: PostModeration,
    reason: string,
    meta: RequestMeta
  ): Promise<void> {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
      include: { topic: { select: { title: true } } }
    });

    if (post === null) {
      throw AppError.notFound('Mensagem não encontrada.');
    }

    const allowed: Record<PostModeration, ForumPostStatus[]> = {
      HIDE: ['PUBLISHED'],
      RESTORE: ['HIDDEN'],
      DELETE: ['PUBLISHED', 'HIDDEN']
    };

    if (!allowed[action].includes(post.status)) {
      throw AppError.conflict(
        'INVALID_TRANSITION',
        'Ação incompatível com a situação da mensagem.'
      );
    }

    const status: ForumPostStatus =
      action === 'HIDE' ? 'HIDDEN' : action === 'RESTORE' ? 'PUBLISHED' : 'DELETED';

    await this.prisma.$transaction(async (tx) => {
      await tx.forumPost.update({
        where: { id },
        data: { status, ...(status === 'DELETED' ? { deletedAt: new Date() } : {}) }
      });
      const actionId = await this.record(
        tx,
        actor,
        {
          postId: id,
          topicId: post.topicId,
          action,
          reason,
          before: { status: post.status },
          after: { status }
        },
        meta
      );

      if (action !== 'RESTORE' && post.authorUserId) {
        await this.notifications.notify(
          {
            userId: post.authorUserId,
            type: 'forum.moderation',
            title: 'Sua mensagem foi moderada',
            message: `Em "${post.topic.title}": ${reason}`,
            link: `/forum/topicos/${post.topicId}`,
            deduplicationKey: `forum-moderation:${actionId}`
          },
          tx
        );
      }
    });
  }

  async reports(query: PageQueryDto & { status?: ForumReportStatus }): Promise<Page<ReportView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.ForumReportWhereInput = query.status ? { status: query.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.forumReport.findMany({
        where,
        include: {
          reporterUser: { select: { name: true } },
          topic: { select: { title: true } },
          post: { select: { content: true, topicId: true, topic: { select: { title: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      this.prisma.forumReport.count({ where })
    ]);

    return toPage(
      rows.map((row) => ({
        id: row.id,
        target: row.postId ? ('POST' as const) : ('TOPIC' as const),
        topicId: row.topicId ?? row.post?.topicId ?? null,
        postId: row.postId,
        topicTitle: row.topic?.title ?? row.post?.topic.title ?? null,
        excerpt: row.post ? row.post.content.slice(0, 280) : null,
        reason: row.reason,
        details: row.details,
        status: row.status,
        reporter: row.reporterUser.name,
        resolution: row.resolution,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString()
      })),
      total,
      page,
      pageSize
    );
  }

  async reviewReport(
    actor: Principal,
    id: string,
    status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED',
    resolution: string | undefined,
    meta: RequestMeta
  ): Promise<void> {
    const report = await this.prisma.forumReport.findUnique({ where: { id } });

    if (report === null) {
      throw AppError.notFound('Denúncia não encontrada.');
    }

    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      throw AppError.conflict('REPORT_CLOSED', 'Esta denúncia já foi concluída.');
    }

    if (status !== 'UNDER_REVIEW' && !resolution) {
      throw AppError.validation('RESOLUTION_REQUIRED', 'Descreva a decisão tomada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.forumReport.update({
        where: { id },
        data: {
          status,
          resolution: resolution ? sanitizeText(resolution) : null,
          reviewedById: actor.userId,
          reviewedAt: new Date()
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'forum.report.reviewed',
          entityType: 'ForumReport',
          entityId: id,
          reason: resolution ?? null,
          before: { status: report.status },
          after: { status },
          meta
        },
        tx
      );
    });
  }

  async moderationHistory(
    query: PageQueryDto & { topicId?: string }
  ): Promise<Page<ModerationView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where: Prisma.ForumModerationActionWhereInput = query.topicId
      ? { topicId: query.topicId }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.forumModerationAction.findMany({
        where,
        include: { moderatorUser: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      this.prisma.forumModerationAction.count({ where })
    ]);

    return toPage(
      rows.map((row) => ({
        id: row.id,
        action: row.action,
        topicId: row.topicId,
        postId: row.postId,
        moderator: row.moderatorUser.name,
        reason: row.reason,
        before: row.beforeData,
        after: row.afterData,
        createdAt: row.createdAt.toISOString()
      })),
      total,
      page,
      pageSize
    );
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
      entityType: 'ForumCategory',
      action: 'forum.category.deleted',
      noun: 'a categoria',
      load: (tx) =>
        tx.forumCategory.findFirst({ where: { id, deletedAt: null }, select: { name: true } }),
      usage: async (tx) => [
        {
          count: await tx.forumTopic.count({ where: { categoryId: id, deletedAt: null } }),
          label: 'tópico(s)'
        }
      ],
      remove: (tx) =>
        tx.forumCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    });
  }
}
