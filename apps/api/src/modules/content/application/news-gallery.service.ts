import { Injectable } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { lockRow } from '../../finance/application/ledger.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService
} from '../../media/application/media.service';
import { isSameImageSet } from '../../store/domain/store-rules';
import { sanitizeText } from '../domain/content-rules';
import { type NewsDetail, NewsService } from './news.service';

/** Uma cobertura de jogo cabe em 30 fotos; mais que isso vira álbum, não notícia. */
export const MAX_NEWS_IMAGES = 30;

/**
 * Galeria de fotos da notícia (D8, DT-081): as mesmas regras das fotos do produto (DT-051),
 * com imagem pública otimizada, ordem, descrição (mostrada como legenda) e remoção lógica.
 */
@Injectable()
export class NewsGalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly news: NewsService
  ) {}

  private async assertNews(id: string): Promise<void> {
    const news = await this.prisma.news.findFirst({
      where: { id, deletedAt: null },
      select: { status: true }
    });

    if (news === null) {
      throw AppError.notFound('Notícia não encontrada.');
    }

    if (news.status === 'ARCHIVED') {
      throw AppError.conflict('NEWS_ARCHIVED', 'Notícia arquivada não pode ser editada.');
    }
  }

  private static text(value: string | null): string | null {
    const clean = value?.trim() ?? '';

    return clean === '' ? null : sanitizeText(clean);
  }

  async add(
    actor: Principal,
    newsId: string,
    file: IncomingFile | undefined,
    altText: string | null,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    await this.assertNews(newsId);
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'news', newsId);

      const count = await tx.newsImage.count({ where: { newsId, deletedAt: null } });

      if (count >= MAX_NEWS_IMAGES) {
        throw AppError.validation(
          'TOO_MANY_IMAGES',
          `Cada notícia pode ter até ${MAX_NEWS_IMAGES} fotos na galeria. Remova uma antes de enviar outra.`
        );
      }

      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        actor.userId,
        tx
      );

      await tx.newsImage.create({
        data: {
          newsId,
          mediaFileId: stored.id,
          altText: NewsGalleryService.text(altText),
          sortOrder: count
        }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'news.image.added',
          entityType: 'News',
          entityId: newsId,
          after: { mediaFileId: stored.id },
          meta
        },
        tx
      );
    });

    return this.news.get(newsId);
  }

  async reorder(
    actor: Principal,
    newsId: string,
    imageIds: readonly string[],
    meta: RequestMeta
  ): Promise<NewsDetail> {
    await this.assertNews(newsId);
    await this.prisma.$transaction(async (tx) => {
      await lockRow(tx, 'news', newsId);

      const current = await tx.newsImage.findMany({
        where: { newsId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true }
      });

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
        await tx.newsImage.update({ where: { id }, data: { sortOrder: index } });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'news.image.reordered',
          entityType: 'News',
          entityId: newsId,
          before: { order: current.map((image) => image.id) },
          after: { order: imageIds },
          meta
        },
        tx
      );
    });

    return this.news.get(newsId);
  }

  private async image(newsId: string, imageId: string) {
    const image = await this.prisma.newsImage.findFirst({
      where: { id: imageId, newsId, deletedAt: null }
    });

    if (image === null) {
      throw AppError.notFound('Foto não encontrada.');
    }

    return image;
  }

  async describe(
    actor: Principal,
    newsId: string,
    imageId: string,
    altText: string | null,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    await this.assertNews(newsId);

    const image = await this.image(newsId, imageId);
    const next = NewsGalleryService.text(altText);

    await this.prisma.$transaction(async (tx) => {
      await tx.newsImage.update({ where: { id: imageId }, data: { altText: next } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'news.image.updated',
          entityType: 'News',
          entityId: newsId,
          before: { altText: image.altText },
          after: { altText: next },
          meta
        },
        tx
      );
    });

    return this.news.get(newsId);
  }

  async remove(
    actor: Principal,
    newsId: string,
    imageId: string,
    meta: RequestMeta
  ): Promise<NewsDetail> {
    await this.assertNews(newsId);
    await this.image(newsId, imageId);
    await this.prisma.$transaction(async (tx) => {
      await tx.newsImage.update({ where: { id: imageId }, data: { deletedAt: new Date() } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'news.image.removed',
          entityType: 'News',
          entityId: newsId,
          before: { imageId },
          meta
        },
        tx
      );
    });

    return this.news.get(newsId);
  }
}
