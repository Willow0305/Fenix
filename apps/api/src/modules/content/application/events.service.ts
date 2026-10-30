import { Injectable } from '@nestjs/common';
import type { EventStatus, EventType, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  IMAGE_POLICY,
  type IncomingFile,
  MediaService,
  mediaUrl
} from '../../media/application/media.service';
import { assertActiveTeam } from '../../sports/application/active-team';
import { slugify } from '../../sports/domain/sports-rules';
import { type MoneyView, moneyView, parseMoney } from '../../../common/domain/money';
import { EVENT_STATUS_LABELS, EVENT_TRANSITIONS, sanitizeText } from '../domain/content-rules';
import { blankToNull, eventDetailsProblems, normalizeState } from '../domain/external-events';
import { ContentAlertsService } from './content-alerts.service';

export interface MatchView {
  readonly opponentName: string;
  readonly competitionName: string | null;
  readonly isHome: boolean;
  readonly teamScore: number | null;
  readonly opponentScore: number | null;
  readonly team: { id: string; name: string } | null;
}

export interface ExternalMatchView {
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly competitionName: string | null;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

export interface EventView {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly type: EventType;
  readonly status: EventStatus;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly locationName: string | null;
  readonly address: string | null;
  readonly isPublic: boolean;
  readonly publishedAt: string | null;
  /** Capa do evento ou, sem ela, a da notícia vinculada mais recente (docs/29 COR-011). */
  readonly coverUrl: string | null;
  readonly match: MatchView | null;
  /** Evento de outro organizador (D3, DT-081). */
  readonly isExternal: boolean;
  readonly organizerName: string | null;
  readonly officialUrl: string | null;
  readonly city: string | null;
  readonly state: string | null;
  /** Entrada: gratuita, com preço ou não informada (`isFree` falso e `price` nulo). */
  readonly admission: { readonly isFree: boolean; readonly price: MoneyView | null };
  readonly externalMatch: ExternalMatchView | null;
  readonly tryout: { id: string; title: string; slug: string } | null;
  readonly news: { id: string; title: string; slug: string }[];
}

export interface MatchInput {
  readonly opponentName: string;
  readonly competitionName?: string | null;
  readonly isHome?: boolean;
  readonly teamId?: string | null;
  readonly teamScore?: number | null;
  readonly opponentScore?: number | null;
}

export interface ExternalMatchInput {
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly competitionName?: string | null;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
}

export interface EventInput {
  readonly title: string;
  readonly type: EventType;
  readonly startsAt: string;
  readonly endsAt?: string | null;
  readonly description?: string | null;
  readonly locationName?: string | null;
  readonly address?: string | null;
  readonly isPublic?: boolean;
  readonly tryoutId?: string | null;
  readonly match?: MatchInput | null;
  readonly isExternal?: boolean;
  /** Textos opcionais: vazio apaga. */
  readonly organizerName?: string | null;
  readonly officialUrl?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly isFree?: boolean;
  /** Decimal em string ("20.00"); vazio apaga. */
  readonly ticketPrice?: string | null;
  /** `null` remove o jogo entre times de fora. */
  readonly externalMatch?: ExternalMatchInput | null;
}

export interface PublicEventQuery {
  readonly scope?: 'upcoming' | 'past';
  readonly type?: EventType;
  readonly limit?: number;
  /** Do Fênix ou de outros organizadores (D3). */
  readonly origin?: 'fenix' | 'external';
  /** Acre em destaque (PEN-069): "outros" é tudo com cidade ou UF fora do Acre. */
  readonly region?: 'acre' | 'outros';
}

export interface EventFilters extends PageQueryDto {
  readonly status?: EventStatus;
  readonly type?: EventType;
}

const EVENT_INCLUDE = {
  match: { include: { team: { select: { id: true, name: true } } } },
  externalMatch: true,
  tryout: { select: { id: true, title: true, slug: true } },
  news: {
    where: {
      deletedAt: null,
      status: { in: ['PUBLISHED', 'SCHEDULED'] },
      publishedAt: { not: null }
    },
    select: { id: true, title: true, slug: true, publishedAt: true, coverMediaFileId: true },
    orderBy: { publishedAt: 'desc' }
  }
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

/** Eventos e partidas, públicos ou internos, ligados a notícia e seletiva (RCF-001, RN-COM-006). */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly alerts: ContentAlertsService
  ) {}

  private toView(row: EventRow, now: Date): EventView {
    const visibleNews = row.news.filter((n) => n.publishedAt !== null && n.publishedAt <= now);
    const cover =
      row.coverMediaFileId ?? visibleNews.find((n) => n.coverMediaFileId)?.coverMediaFileId;

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.type,
      status: row.status,
      description: row.description,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      locationName: row.locationName,
      address: row.address,
      isPublic: row.isPublic,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      coverUrl: cover ? mediaUrl(cover) : null,
      match: row.match
        ? {
            opponentName: row.match.opponentName,
            competitionName: row.match.competitionName,
            isHome: row.match.isHome,
            teamScore: row.match.teamScore,
            opponentScore: row.match.opponentScore,
            team: row.match.team
          }
        : null,
      isExternal: row.isExternal,
      organizerName: row.organizerName,
      officialUrl: row.officialUrl,
      city: row.city,
      state: row.state,
      admission: {
        isFree: row.isFree,
        price: row.ticketPrice ? moneyView(row.ticketPrice, row.ticketCurrency) : null
      },
      externalMatch: row.externalMatch
        ? {
            homeTeamName: row.externalMatch.homeTeamName,
            awayTeamName: row.externalMatch.awayTeamName,
            competitionName: row.externalMatch.competitionName,
            homeScore: row.externalMatch.homeScore,
            awayScore: row.externalMatch.awayScore
          }
        : null,
      tryout: row.tryout,
      // Somente notícias já visíveis, mesmo na visão do evento (sem vazar agendadas).
      news: visibleNews.map((n) => ({ id: n.id, title: n.title, slug: n.slug }))
    };
  }

  private async uniqueSlug(title: string, startsAt: Date, ignoreId?: string): Promise<string> {
    const base = slugify(`${title}-${startsAt.toISOString().slice(0, 10)}`) || 'evento';
    let slug = base;

    for (let n = 2; ; n += 1) {
      const existing = await this.prisma.event.findUnique({
        where: { slug },
        select: { id: true }
      });

      if (existing === null || existing.id === ignoreId) {
        return slug;
      }

      slug = `${base}-${n}`;
    }
  }

  async list(filters: EventFilters): Promise<Page<EventView>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const search = filters.search?.trim();
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {})
    };
    const now = new Date();
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy: { startsAt: 'desc' },
        skip,
        take
      }),
      this.prisma.event.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.toView(row, now)),
      total,
      page,
      pageSize
    );
  }

  /** Capa 16:9 do evento (PEN-058, DT-041): imagem pública otimizada em WebP. */
  async setCover(
    actor: Principal,
    id: string,
    file: IncomingFile | undefined,
    meta: RequestMeta
  ): Promise<EventView> {
    const current = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: { coverMediaFileId: true }
    });

    if (current === null) {
      throw AppError.notFound('Evento não encontrado.');
    }

    await this.prisma.$transaction(async (tx) => {
      const stored = await this.media.store(
        file,
        { ...IMAGE_POLICY, kind: 'IMAGE', classification: 'PUBLIC' },
        actor.userId,
        tx
      );

      await tx.event.update({ where: { id }, data: { coverMediaFileId: stored.id } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'event.cover.updated',
          entityType: 'Event',
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

  async get(id: string): Promise<EventView> {
    const row = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: EVENT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Evento não encontrado.');
    }

    return this.toView(row, new Date());
  }

  private validateWindow(startsAt: Date, endsAt: Date | null): void {
    if (Number.isNaN(startsAt.getTime())) {
      throw AppError.validation('INVALID_DATE', 'Informe a data de início.');
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw AppError.validation('INVALID_DATE', 'Data de término inválida.');
    }

    if (endsAt && endsAt <= startsAt) {
      throw AppError.validation('INVALID_WINDOW', 'O término deve ser após o início.');
    }
  }

  private async assertTryout(tryoutId: string, eventId?: string): Promise<void> {
    const tryout = await this.prisma.tryout.findFirst({
      where: { id: tryoutId, deletedAt: null },
      select: { eventId: true }
    });

    if (tryout === null) {
      throw AppError.validation('INVALID_TRYOUT', 'Seletiva inexistente.');
    }

    if (tryout.eventId && tryout.eventId !== eventId) {
      throw AppError.conflict('TRYOUT_LINKED', 'Esta seletiva já está ligada a outro evento.');
    }
  }

  private matchData(match: MatchInput): Omit<Prisma.MatchUncheckedCreateInput, 'eventId'> {
    return {
      opponentName: sanitizeText(match.opponentName),
      competitionName: match.competitionName ? sanitizeText(match.competitionName) : null,
      isHome: match.isHome ?? true,
      teamId: match.teamId ?? null,
      teamScore: match.teamScore ?? null,
      opponentScore: match.opponentScore ?? null
    };
  }

  private externalMatchData(
    match: ExternalMatchInput
  ): Omit<Prisma.ExternalMatchUncheckedCreateInput, 'eventId'> {
    return {
      homeTeamName: sanitizeText(match.homeTeamName),
      awayTeamName: sanitizeText(match.awayTeamName),
      competitionName: match.competitionName ? sanitizeText(match.competitionName) : null,
      homeScore: match.homeScore ?? null,
      awayScore: match.awayScore ?? null
    };
  }

  /** Campos de agenda (D3) já normalizados, só os informados na entrada. */
  private detailsData(input: Partial<EventInput>) {
    const text = (value: string | null | undefined) => {
      const clean = blankToNull(value);

      return clean === null ? null : sanitizeText(clean);
    };
    const price = blankToNull(input.ticketPrice);

    return {
      ...(input.isExternal === undefined ? {} : { isExternal: input.isExternal }),
      ...(input.organizerName === undefined ? {} : { organizerName: text(input.organizerName) }),
      ...(input.officialUrl === undefined ? {} : { officialUrl: blankToNull(input.officialUrl) }),
      ...(input.city === undefined ? {} : { city: text(input.city) }),
      ...(input.state === undefined ? {} : { state: normalizeState(input.state) }),
      ...(input.isFree === undefined ? {} : { isFree: input.isFree }),
      ...(input.ticketPrice === undefined
        ? {}
        : { ticketPrice: price === null ? null : parseMoney(price, 'ticketPrice') })
    };
  }

  /** Valida o resultado final (o que já existe com o que chegou), como o banco também exige. */
  private assertDetails(
    current: {
      isExternal: boolean;
      organizerName: string | null;
      officialUrl: string | null;
      state: string | null;
      isFree: boolean;
      ticketPrice: Prisma.Decimal | null;
      hasTeamMatch: boolean;
      hasExternalMatch: boolean;
    },
    input: Partial<EventInput>
  ): void {
    const problems = eventDetailsProblems({
      isExternal: input.isExternal ?? current.isExternal,
      organizerName:
        input.organizerName === undefined
          ? current.organizerName
          : blankToNull(input.organizerName),
      officialUrl:
        input.officialUrl === undefined ? current.officialUrl : blankToNull(input.officialUrl),
      state: input.state === undefined ? current.state : normalizeState(input.state),
      isFree: input.isFree ?? current.isFree,
      ticketPrice:
        input.ticketPrice === undefined
          ? (current.ticketPrice?.toFixed(2) ?? null)
          : blankToNull(input.ticketPrice),
      hasTeamMatch: input.match ? true : current.hasTeamMatch,
      hasExternalMatch:
        input.externalMatch === undefined ? current.hasExternalMatch : input.externalMatch !== null
    });

    if (problems.length > 0) {
      throw AppError.validation(
        'EVENT_DETAILS_INVALID',
        problems.join(' '),
        problems.map((message) => ({ field: 'event', code: 'INVALID', message }))
      );
    }
  }

  async create(actor: Principal, input: EventInput, meta: RequestMeta): Promise<EventView> {
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;

    this.validateWindow(startsAt, endsAt);

    if (input.tryoutId) {
      await this.assertTryout(input.tryoutId);
    }

    if (input.type === 'MATCH' && !input.match && !input.isExternal) {
      throw AppError.validation('MATCH_REQUIRED', 'Informe o adversário da partida.');
    }

    this.assertDetails(
      {
        isExternal: false,
        organizerName: null,
        officialUrl: null,
        state: null,
        isFree: false,
        ticketPrice: null,
        hasTeamMatch: false,
        hasExternalMatch: false
      },
      input
    );

    const slug = await this.uniqueSlug(input.title, startsAt);
    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title: sanitizeText(input.title),
          slug,
          type: input.type,
          description: input.description ? sanitizeText(input.description) : null,
          startsAt,
          endsAt,
          locationName: input.locationName ?? null,
          address: input.address ?? null,
          isPublic: input.isPublic ?? false,
          ...this.detailsData(input)
        }
      });

      if (input.externalMatch) {
        await tx.externalMatch.create({
          data: { eventId: created.id, ...this.externalMatchData(input.externalMatch) }
        });
      }

      if (input.match) {
        await assertActiveTeam(tx, input.match.teamId);
        await tx.match.create({ data: { eventId: created.id, ...this.matchData(input.match) } });
      }

      if (input.tryoutId) {
        await tx.tryout.update({ where: { id: input.tryoutId }, data: { eventId: created.id } });
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'event.created',
          entityType: 'Event',
          entityId: created.id,
          after: { title: created.title, type: created.type, isPublic: created.isPublic },
          meta
        },
        tx
      );

      return created.id;
    });

    return this.get(id);
  }

  async update(
    actor: Principal,
    id: string,
    input: Partial<EventInput>,
    meta: RequestMeta
  ): Promise<EventView> {
    const current = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: { match: true, externalMatch: true, tryout: { select: { id: true } } }
    });

    if (current === null) {
      throw AppError.notFound('Evento não encontrado.');
    }

    this.assertDetails(
      {
        ...current,
        hasTeamMatch: current.match !== null,
        hasExternalMatch: current.externalMatch !== null
      },
      input
    );

    const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
    const endsAt =
      input.endsAt === undefined ? current.endsAt : input.endsAt ? new Date(input.endsAt) : null;

    this.validateWindow(startsAt, endsAt);

    if (input.tryoutId) {
      await this.assertTryout(input.tryoutId, id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...(input.title === undefined ? {} : { title: sanitizeText(input.title) }),
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.description === undefined
            ? {}
            : { description: input.description ? sanitizeText(input.description) : null }),
          startsAt,
          endsAt,
          ...(input.locationName === undefined ? {} : { locationName: input.locationName }),
          ...(input.address === undefined ? {} : { address: input.address }),
          ...(input.isPublic === undefined ? {} : { isPublic: input.isPublic }),
          ...this.detailsData(input)
        }
      });

      if (input.externalMatch === null) {
        await tx.externalMatch.deleteMany({ where: { eventId: id } });
      } else if (input.externalMatch) {
        const data = this.externalMatchData(input.externalMatch);

        await tx.externalMatch.upsert({
          where: { eventId: id },
          create: { eventId: id, ...data },
          update: data
        });
      }

      if (input.match) {
        const existing = await tx.match.findUnique({
          where: { eventId: id },
          select: { teamId: true }
        });

        await assertActiveTeam(tx, input.match.teamId, existing?.teamId ?? null);

        const data = this.matchData(input.match);

        await tx.match.upsert({
          where: { eventId: id },
          create: { eventId: id, ...data },
          update: data
        });
      }

      if (input.tryoutId !== undefined) {
        if (current.tryout && current.tryout.id !== input.tryoutId) {
          await tx.tryout.update({ where: { id: current.tryout.id }, data: { eventId: null } });
        }

        if (input.tryoutId) {
          await tx.tryout.update({ where: { id: input.tryoutId }, data: { eventId: id } });
        }
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'event.updated',
          entityType: 'Event',
          entityId: id,
          before: {
            startsAt: current.startsAt.toISOString(),
            isPublic: current.isPublic,
            score: current.match
              ? `${current.match.teamScore ?? '-'}x${current.match.opponentScore ?? '-'}`
              : current.externalMatch
                ? `${current.externalMatch.homeScore ?? '-'}x${current.externalMatch.awayScore ?? '-'}`
                : null,
            isExternal: current.isExternal
          },
          after: { fields: Object.keys(input) },
          meta
        },
        tx
      );
    });

    // Evento que virou público já agendado: avisa os inscritos (DT-067).
    await this.alerts.event(id);

    return this.get(id);
  }

  /** Confirmar publica o evento (se público); cancelar exige motivo e mantém o registro. */
  async changeStatus(
    actor: Principal,
    id: string,
    status: EventStatus,
    reason: string | undefined,
    meta: RequestMeta
  ): Promise<EventView> {
    const current = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Evento não encontrado.');
    }

    assertTransition(EVENT_TRANSITIONS, current.status, status, EVENT_STATUS_LABELS);

    if (status === 'CANCELLED' && !reason) {
      throw AppError.validation('REASON_REQUIRED', 'Informe o motivo do cancelamento.');
    }

    await this.prisma.event.update({
      where: { id },
      data: {
        status,
        ...(status === 'SCHEDULED' && current.publishedAt === null
          ? { publishedAt: new Date() }
          : {}),
        ...(status === 'DRAFT' ? { publishedAt: null } : {})
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'event.status.changed',
      entityType: 'Event',
      entityId: id,
      reason: reason ?? null,
      before: { status: current.status },
      after: { status },
      meta
    });

    // Evento público que entrou na agenda: avisa os inscritos uma vez (DT-067).
    if (status === 'SCHEDULED') {
      await this.alerts.event(id);
    }

    return this.get(id);
  }

  /** Calendário público: só eventos públicos já publicados (próximos ou recentes). */
  async publicList(query: PublicEventQuery): Promise<EventView[]> {
    const now = new Date();
    const upcoming = query.scope !== 'past';
    const rows = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        isPublic: true,
        publishedAt: { lte: now },
        ...(query.type ? { type: query.type } : {}),
        ...(query.origin ? { isExternal: query.origin === 'external' } : {}),
        ...(query.region === 'acre' ? { state: 'AC' } : {}),
        ...(query.region === 'outros'
          ? {
              AND: [
                { OR: [{ state: null }, { state: { not: 'AC' } }] },
                { OR: [{ city: { not: null } }, { state: { not: null } }] }
              ]
            }
          : {}),
        status: upcoming ? { in: ['SCHEDULED', 'CANCELLED'] } : { in: ['COMPLETED', 'SCHEDULED'] },
        ...(upcoming
          ? { startsAt: { gte: new Date(now.getTime() - 6 * 3_600_000) } }
          : { startsAt: { lt: now } })
      },
      include: EVENT_INCLUDE,
      orderBy: { startsAt: upcoming ? 'asc' : 'desc' },
      take: Math.min(query.limit ?? 30, 60)
    });

    return rows.map((row) => this.toView(row, now));
  }

  async publicGet(slug: string): Promise<EventView> {
    const now = new Date();
    const row = await this.prisma.event.findFirst({
      where: {
        slug,
        deletedAt: null,
        isPublic: true,
        publishedAt: { lte: now },
        status: { not: 'DRAFT' }
      },
      include: EVENT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Evento não encontrado.');
    }

    return this.toView(row, now);
  }
}
