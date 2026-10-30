import { Injectable } from '@nestjs/common';

import { civilToDate, todayIn } from '../../../common/domain/civil-date';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MOST_READ_DAYS, rankMostRead, windowStart } from '../domain/most-read';
import { type NewsSummary, NewsService, publicWhere } from './news.service';

/**
 * Leituras de notícias com contagem própria (D5, DT-081): o site avisa uma leitura por
 * notícia e aba do navegador; aqui só se soma por notícia e dia. Nada identifica quem leu.
 */
@Injectable()
export class NewsViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly news: NewsService
  ) {}

  /** Soma uma leitura de notícia pública; notícia inexistente ou oculta é ignorada. */
  async record(slug: string, now: Date = new Date()): Promise<void> {
    const news = await this.prisma.news.findFirst({
      where: { slug, ...publicWhere(now) },
      select: { id: true }
    });

    if (news === null) {
      return;
    }

    const day = civilToDate(todayIn(undefined, now));

    // Atômico mesmo com leituras simultâneas: cria o dia ou soma 1.
    await this.prisma.$executeRaw`
      INSERT INTO news_daily_views (id, news_id, day, views)
      VALUES (gen_random_uuid(), ${news.id}::uuid, ${day}::date, 1)
      ON CONFLICT (news_id, day) DO UPDATE SET views = news_daily_views.views + 1`;
  }

  /** As mais lidas dos últimos 7 dias, entre as notícias ainda públicas. */
  async mostRead(limit = 5, now: Date = new Date()): Promise<NewsSummary[]> {
    const from = civilToDate(windowStart(todayIn(undefined, now), MOST_READ_DAYS));
    const totals = await this.prisma.newsDailyView.groupBy({
      by: ['newsId'],
      where: { day: { gte: from }, news: publicWhere(now) },
      _sum: { views: true }
    });
    const summaries = await this.news.publicSummaries(totals.map((row) => row.newsId));
    const views = new Map(totals.map((row) => [row.newsId, row._sum.views ?? 0]));

    return rankMostRead(
      summaries.map((summary) => ({
        summary,
        views: views.get(summary.id) ?? 0,
        publishedAt: summary.publishedAt ? new Date(summary.publishedAt) : null
      })),
      Math.min(Math.max(limit, 1), 10)
    ).map((row) => row.summary);
  }
}
