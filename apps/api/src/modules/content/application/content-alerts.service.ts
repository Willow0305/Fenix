import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { NotificationCategory } from '../../../generated/prisma/client';

import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  type NotifyInput,
  NotificationsService
} from '../../notifications/application/notifications.service';

/** Conteúdo publicado há mais tempo que isto não é anunciado (ex.: agendado e esquecido). */
const MAX_AGE_MS = 7 * 24 * 3_600_000;
const BATCH = 500;

/**
 * Avisos de conteúdo novo (DT-067): notícia publicada, evento público e tópico em categoria
 * pública. Só recebe quem ligou e-mail ou WhatsApp na finalidade; cada conteúdo é anunciado
 * uma vez (marca `announcedAt` + chave idempotente por pessoa). Agendados entram na rotina
 * a cada 5 minutos, quando ficam visíveis. Falha aqui nunca desfaz a publicação.
 */
@Injectable()
export class ContentAlertsService implements OnModuleInit {
  private readonly logger = new Logger('AvisosDeConteudo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobScheduler
  ) {}

  onModuleInit(): void {
    this.jobs.every('content.alerts', 5 * 60_000, async () => {
      await this.announceDue();
    });
  }

  /** Anuncia tudo o que ficou visível e ainda não foi anunciado. */
  async announceDue(now: Date = new Date()): Promise<number> {
    const since = new Date(now.getTime() - MAX_AGE_MS);
    const [news, events] = await Promise.all([
      this.prisma.news.findMany({
        where: {
          deletedAt: null,
          announcedAt: null,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          publishedAt: { lte: now, gte: since }
        },
        select: { id: true }
      }),
      this.prisma.event.findMany({
        where: {
          deletedAt: null,
          announcedAt: null,
          isPublic: true,
          status: 'SCHEDULED',
          publishedAt: { lte: now, gte: since },
          startsAt: { gte: now }
        },
        select: { id: true }
      })
    ]);
    let sent = 0;

    for (const row of news) {
      sent += await this.news(row.id, now);
    }

    for (const row of events) {
      sent += await this.event(row.id, now);
    }

    return sent;
  }

  /** Notícia publicada (agora ou agendada que chegou a hora). */
  async news(id: string, now: Date = new Date()): Promise<number> {
    return this.safely(async () => {
      const row = await this.prisma.news.findFirst({
        where: {
          id,
          deletedAt: null,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          publishedAt: { lte: now }
        },
        select: { title: true, summary: true, slug: true }
      });

      if (row === null || !(await this.claim('news', id))) {
        return 0;
      }

      return this.fanOut('NEWS', (userId) => ({
        userId,
        type: 'content.news',
        title: `Notícia: ${row.title}`,
        message: row.summary ?? 'Uma nova notícia foi publicada no site do clube.',
        link: `/noticias/${row.slug}`,
        deduplicationKey: `content-news:${id}:${userId}`
      }));
    });
  }

  /** Evento público publicado que ainda vai acontecer. */
  async event(id: string, now: Date = new Date()): Promise<number> {
    return this.safely(async () => {
      const row = await this.prisma.event.findFirst({
        where: {
          id,
          deletedAt: null,
          isPublic: true,
          status: 'SCHEDULED',
          publishedAt: { lte: now },
          startsAt: { gte: now }
        },
        select: { title: true, slug: true, startsAt: true, locationName: true }
      });

      if (row === null || !(await this.claim('event', id))) {
        return 0;
      }

      const when = row.startsAt.toLocaleString('pt-BR', {
        timeZone: 'America/Rio_Branco',
        dateStyle: 'short',
        timeStyle: 'short'
      });

      return this.fanOut('EVENTS', (userId) => ({
        userId,
        type: 'content.event',
        title: `Evento: ${row.title}`,
        message: `${when}${row.locationName ? ` · ${row.locationName}` : ''}`,
        link: `/eventos#${row.slug}`,
        deduplicationKey: `content-event:${id}:${userId}`
      }));
    });
  }

  /** Tópico novo em categoria pública; o autor não é avisado do próprio tópico. */
  async forumTopic(id: string): Promise<number> {
    return this.safely(async () => {
      const row = await this.prisma.forumTopic.findFirst({
        where: { id, deletedAt: null, status: 'PUBLISHED', visibility: 'PUBLIC' },
        select: { title: true, authorUserId: true, category: { select: { name: true } } }
      });

      if (row === null) {
        return 0;
      }

      return this.fanOut(
        'FORUM_TOPICS',
        (userId) => ({
          userId,
          type: 'content.forum_topic',
          title: `Fórum: ${row.title}`,
          message: `Novo tópico em ${row.category.name}.`,
          link: `/forum/topicos/${id}`,
          deduplicationKey: `content-forum-topic:${id}:${userId}`
        }),
        row.authorUserId
      );
    });
  }

  /** Marca o conteúdo como anunciado; só uma chamada consegue (corrida entre instâncias). */
  private async claim(kind: 'news' | 'event', id: string): Promise<boolean> {
    const where = { id, announcedAt: null };
    const data = { announcedAt: new Date() };
    const { count } =
      kind === 'news'
        ? await this.prisma.news.updateMany({ where, data })
        : await this.prisma.event.updateMany({ where, data });

    return count === 1;
  }

  /** Pessoas ativas que ligaram algum canal externo na finalidade, em lotes. */
  private async fanOut(
    category: NotificationCategory,
    build: (userId: string) => NotifyInput,
    exceptUserId: string | null = null
  ): Promise<number> {
    let cursor: string | undefined;
    let sent = 0;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
          notificationPreferences: { some: { category, enabled: true } }
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
      });

      if (users.length === 0) {
        return sent;
      }

      sent += await this.notifications.notify(users.map((user) => build(user.id)));
      cursor = users[users.length - 1]?.id;
    }
  }

  private async safely(task: () => Promise<number>): Promise<number> {
    try {
      return await task();
    } catch (error) {
      this.logger.warn(
        `Falha ao avisar sobre conteúdo novo: ${error instanceof Error ? error.name : 'erro'}.`
      );

      return 0;
    }
  }
}
