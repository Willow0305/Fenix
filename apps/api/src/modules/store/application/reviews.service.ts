import { Injectable } from '@nestjs/common';
import type { ProductReviewStatus } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { type Page, type PageQueryDto, pageArgs, toPage } from '../../../common/http/pagination';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import {
  normalizeComment,
  ratingSummary,
  reviewerName,
  reviewProblems,
  type ReviewInput
} from '../domain/reviews';

export interface PublicReviewView {
  readonly id: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly author: string;
  readonly createdAt: string;
}

export interface ProductReviewsView {
  readonly average: number | null;
  readonly count: number;
  readonly reviews: PublicReviewView[];
}

export interface MyReviewView {
  readonly canReview: boolean;
  readonly review: {
    readonly rating: number;
    readonly comment: string | null;
    readonly status: ProductReviewStatus;
    readonly moderationReason: string | null;
  } | null;
}

export interface AdminReviewView {
  readonly id: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly status: ProductReviewStatus;
  readonly author: string;
  readonly product: { readonly id: string; readonly name: string; readonly slug: string };
  readonly createdAt: string;
  readonly moderatedAt: string | null;
  readonly moderationReason: string | null;
}

/**
 * Avaliações de produto (DT-081): estrelas de 1 a 5 e comentário, só de quem comprou e
 * recebeu (pedido entregue), uma por produto e pessoa, publicadas depois de aprovadas pela
 * diretoria e exibidas com o primeiro nome.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly staffAlerts: StaffAlertsService
  ) {}

  async forProduct(slug: string): Promise<ProductReviewsView> {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true }
    });

    if (product === null) {
      throw AppError.notFound('Produto não encontrado.');
    }

    const where = { productId: product.id, status: 'APPROVED' as const, deletedAt: null };
    const [ratings, rows] = await Promise.all([
      this.prisma.productReview.findMany({ where, select: { rating: true } }),
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } }
      })
    ]);

    return {
      ...ratingSummary(ratings.map((row) => row.rating)),
      reviews: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        author: reviewerName(row.user.name),
        createdAt: row.createdAt.toISOString()
      }))
    };
  }

  /** Comprou e recebeu: pedido da própria pessoa, entregue, com o produto. Afiliação não entra. */
  private async eligible(userId: string, productId: string): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: {
        customerUserId: userId,
        status: 'DELIVERED',
        items: {
          some: {
            productVariant: { productId, product: { fulfillmentType: { not: 'MEMBERSHIP' } } }
          }
        }
      },
      select: { id: true }
    });

    return order !== null;
  }

  async mine(userId: string, productId: string): Promise<MyReviewView> {
    const [canReview, review] = await Promise.all([
      this.eligible(userId, productId),
      this.prisma.productReview.findFirst({
        where: { userId, productId, deletedAt: null },
        select: { rating: true, comment: true, status: true, moderationReason: true }
      })
    ]);

    return { canReview, review };
  }

  /** Cria ou edita a própria avaliação; toda edição volta para a fila de aprovação. */
  async save(userId: string, productId: string, input: ReviewInput): Promise<MyReviewView> {
    const problems = reviewProblems(input);

    if (problems.length > 0) {
      throw AppError.validation(
        'REVIEW_INVALID',
        problems.join(' '),
        problems.map((message) => ({ field: 'review', code: 'INVALID', message }))
      );
    }

    if (!(await this.eligible(userId, productId))) {
      throw new AppError(
        'FORBIDDEN',
        'NOT_ELIGIBLE',
        'Só quem comprou e recebeu este produto pode avaliar.'
      );
    }

    const data = {
      rating: input.rating,
      comment: normalizeComment(input.comment),
      status: 'PENDING' as const,
      moderatedById: null,
      moderatedAt: null,
      moderationReason: null,
      deletedAt: null
    };
    const review = await this.prisma.productReview.upsert({
      where: { productId_userId: { productId, userId } },
      create: { productId, userId, ...data },
      update: data,
      select: { id: true, updatedAt: true, product: { select: { name: true } } }
    });

    // Aviso de trabalho para quem modera; falhar aqui não desfaz a avaliação.
    await this.staffAlerts.alert('reviews.moderate', {
      type: 'staff.review_pending',
      title: 'Avaliação para aprovar',
      message: `Nova avaliação de ${review.product.name}.`,
      link: '/admin/avaliacoes',
      key: `review:${review.id}:${review.updatedAt.getTime()}`
    });

    return this.mine(userId, productId);
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.productReview.updateMany({
      where: { userId, productId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
  }

  async list(
    query: PageQueryDto & { status?: ProductReviewStatus | undefined }
  ): Promise<Page<AdminReviewView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const where = { deletedAt: null, ...(query.status ? { status: query.status } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: query.status === 'PENDING' ? 'asc' : 'desc' },
        include: {
          user: { select: { name: true } },
          product: { select: { id: true, name: true, slug: true } }
        },
        skip,
        take
      }),
      this.prisma.productReview.count({ where })
    ]);

    return toPage(
      rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        status: row.status,
        author: row.user.name,
        product: row.product,
        createdAt: row.createdAt.toISOString(),
        moderatedAt: row.moderatedAt?.toISOString() ?? null,
        moderationReason: row.moderationReason
      })),
      total,
      page,
      pageSize
    );
  }

  /** Aprovar publica; recusar exige motivo, que a pessoa recebe. Fica na auditoria. */
  async moderate(
    actor: Principal,
    id: string,
    input: { decision: 'APPROVE' | 'REJECT'; reason?: string | undefined },
    meta: RequestMeta
  ): Promise<AdminReviewView> {
    const reason = input.reason?.trim() || null;

    if (input.decision === 'REJECT' && (reason === null || reason.length < 3)) {
      throw AppError.validation('REASON_REQUIRED', 'Conte o motivo da recusa para a pessoa.');
    }

    const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.productReview.findFirst({
        where: { id, deletedAt: null },
        select: { status: true, userId: true, product: { select: { name: true, slug: true } } }
      });

      if (current === null) {
        throw AppError.notFound('Avaliação não encontrada.');
      }

      const updated = await tx.productReview.update({
        where: { id },
        data: {
          status,
          moderatedById: actor.userId,
          moderatedAt: new Date(),
          moderationReason: status === 'REJECTED' ? reason : null
        },
        select: { updatedAt: true }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'review.moderated',
          entityType: 'ProductReview',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );
      await this.notifications.notify(
        {
          userId: current.userId,
          type: status === 'APPROVED' ? 'store.review_approved' : 'store.review_rejected',
          title: status === 'APPROVED' ? 'Avaliação publicada' : 'Avaliação não publicada',
          message:
            status === 'APPROVED'
              ? `Sua avaliação de ${current.product.name} está no site. Obrigado.`
              : `Sua avaliação de ${current.product.name} não foi publicada: ${reason ?? ''}`,
          link: `/loja/${current.product.slug}`,
          deduplicationKey: `review-${status}:${id}:${updated.updatedAt.getTime()}`
        },
        tx
      );
    });

    return this.one(id);
  }

  private async one(id: string): Promise<AdminReviewView> {
    const row = await this.prisma.productReview.findFirstOrThrow({
      where: { id },
      include: {
        user: { select: { name: true } },
        product: { select: { id: true, name: true, slug: true } }
      }
    });

    return {
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      status: row.status,
      author: row.user.name,
      product: row.product,
      createdAt: row.createdAt.toISOString(),
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
      moderationReason: row.moderationReason
    };
  }
}
