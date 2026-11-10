import { Injectable } from '@nestjs/common';

import type { ForumSanctionKind, Prisma } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { TEAM_TIME_ZONE } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { defaultSettingsData, SETTINGS_KEY } from '../../settings/application/settings.service';
import {
  DEFAULT_FORUM_RULES,
  isActiveSuspension,
  longestSuspension,
  REASON_MAX,
  REASON_MIN,
  RULE_MAX,
  RULES_MAX,
  ruleTitles,
  type SuspensionDays,
  suspensionEnd
} from '../domain/forum-sanctions';

export interface SanctionInput {
  readonly userId: string;
  readonly kind: ForumSanctionKind;
  readonly rule: string;
  readonly reason: string;
  /** Só na suspensão: 7, 30 ou `null` (até a diretoria liberar). */
  readonly days?: SuspensionDays | null;
  readonly topicId?: string | null;
  readonly postId?: string | null;
}

export interface SanctionView {
  readonly id: string;
  readonly kind: ForumSanctionKind;
  readonly user: { id: string; name: string };
  readonly rule: string;
  readonly reason: string;
  readonly topicId: string | null;
  readonly postId: string | null;
  readonly endsAt: string | null;
  readonly active: boolean;
  readonly liftedAt: string | null;
  readonly liftedBy: string | null;
  readonly liftReason: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

/** Situação de quem está vendo o fórum: a suspensão em vigor, se houver. */
export interface ForumStanding {
  readonly suspension: {
    readonly until: string | null;
    readonly rule: string;
    readonly reason: string;
  } | null;
}

export interface ForumRulesView {
  readonly text: string;
  /** Texto escrito pela diretoria; `false` = texto inicial do sistema. */
  readonly custom: boolean;
  readonly titles: readonly string[];
}

const SANCTION_INCLUDE = {
  user: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  liftedBy: { select: { name: true } }
} satisfies Prisma.ForumSanctionInclude;

type SanctionRow = Prisma.ForumSanctionGetPayload<{ include: typeof SANCTION_INCLUDE }>;

function when(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TEAM_TIME_ZONE
  }).format(date);
}

/**
 * Suspensão em vigor da pessoa (DT-108); `null` se pode participar. Usada pelo fórum antes
 * de publicar, responder, editar ou reagir.
 */
export async function activeSuspension(
  db: PrismaService | PrismaTx,
  userId: string,
  now: Date = new Date()
) {
  const rows = await db.forumSanction.findMany({
    where: {
      userId,
      kind: 'SUSPENSION',
      liftedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }]
    },
    select: { kind: true, endsAt: true, liftedAt: true, rule: true, reason: true }
  });

  return longestSuspension(rows, now);
}

/** Mensagem do erro para quem tenta participar suspenso. */
export function suspendedMessage(endsAt: Date | null): string {
  return endsAt
    ? `Você está suspenso do fórum até ${when(endsAt)}. Até lá, você lê o fórum, mas não publica, responde, edita nem reage.`
    : 'Você está suspenso do fórum até a diretoria liberar. Enquanto isso, você lê o fórum, mas não publica, responde, edita nem reage.';
}

/**
 * Advertências e suspensões do fórum (DT-108): a diretoria avisa quem quebrou uma regra e,
 * se for o caso, suspende por 7 dias, 30 dias ou até liberar. Tudo fica registrado; nada é
 * apagado. A pessoa recebe o aviso no site e por e-mail, com o motivo e as regras.
 */
@Injectable()
export class ForumSanctionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  // ---------- Regras ----------

  async rules(): Promise<ForumRulesView> {
    const row = await this.prisma.teamSettings.findUnique({
      where: { singletonKey: SETTINGS_KEY },
      select: { forumRules: true }
    });
    const custom = row?.forumRules?.trim() ? row.forumRules : null;
    const text = custom ?? DEFAULT_FORUM_RULES;

    return { text, custom: custom !== null, titles: ruleTitles(text) };
  }

  /** Texto vazio volta ao texto inicial do sistema. */
  async setRules(actor: Principal, text: string, meta: RequestMeta): Promise<ForumRulesView> {
    const clean = text.trim();

    if (clean.length > RULES_MAX) {
      throw AppError.validation('RULES_TOO_LONG', `Use até ${RULES_MAX} caracteres.`, [
        { field: 'text', code: 'TOO_LONG', message: `Use até ${RULES_MAX} caracteres.` }
      ]);
    }

    const settings = await this.prisma.teamSettings.upsert({
      where: { singletonKey: SETTINGS_KEY },
      create: defaultSettingsData(),
      update: {},
      select: { id: true, forumRules: true }
    });

    await this.prisma.teamSettings.update({
      where: { id: settings.id },
      data: { forumRules: clean || null }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'forum.rules.updated',
      entityType: 'TeamSettings',
      entityId: settings.id,
      before: { custom: settings.forumRules !== null },
      after: { custom: clean.length > 0, length: clean.length },
      meta
    });

    return this.rules();
  }

  // ---------- Situação de quem está vendo ----------

  async standing(principal: Principal): Promise<ForumStanding> {
    const suspension = await activeSuspension(this.prisma, principal.userId);

    return {
      suspension: suspension
        ? {
            until: suspension.endsAt?.toISOString() ?? null,
            rule: suspension.rule,
            reason: suspension.reason
          }
        : null
    };
  }

  // ---------- Moderação ----------

  async list(
    query: PageQueryDto & { userId?: string; active?: boolean }
  ): Promise<Page<SanctionView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const now = new Date();
    const where: Prisma.ForumSanctionWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.active
        ? {
            kind: 'SUSPENSION',
            liftedAt: null,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.forumSanction.findMany({
        where,
        include: SANCTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      this.prisma.forumSanction.count({ where })
    ]);

    return toPage(
      rows.map((row) => this.view(row, now)),
      total,
      page,
      pageSize
    );
  }

  async create(actor: Principal, input: SanctionInput, meta: RequestMeta): Promise<SanctionView> {
    const rule = input.rule.trim();
    const reason = input.reason.trim();
    const problems = [
      ...(rule.length < 2 || rule.length > RULE_MAX
        ? [{ field: 'rule', code: 'INVALID', message: 'Diga qual regra foi quebrada.' }]
        : []),
      ...(reason.length < REASON_MIN || reason.length > REASON_MAX
        ? [
            {
              field: 'reason',
              code: 'INVALID',
              message: `Explique o motivo com ${REASON_MIN} a ${REASON_MAX} caracteres.`
            }
          ]
        : [])
    ];

    if (problems.length > 0) {
      throw AppError.validation('SANCTION_INVALID', 'Revise a regra e o motivo.', problems);
    }

    if (input.userId === actor.userId) {
      throw AppError.validation('SANCTION_SELF', 'Você não pode advertir a própria conta.', [
        { field: 'userId', code: 'SELF', message: 'Você não pode advertir a própria conta.' }
      ]);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true, name: true }
    });

    if (!user) {
      throw AppError.notFound('Pessoa não encontrada.');
    }

    const now = new Date();
    const endsAt = input.kind === 'SUSPENSION' ? suspensionEnd(now, input.days ?? null) : null;
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.forumSanction.create({
        data: {
          userId: user.id,
          kind: input.kind,
          rule,
          reason,
          topicId: input.topicId ?? null,
          postId: input.postId ?? null,
          endsAt,
          createdById: actor.userId
        },
        include: SANCTION_INCLUDE
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: input.kind === 'WARNING' ? 'forum.sanction.warned' : 'forum.sanction.suspended',
          entityType: 'ForumSanction',
          entityId: row.id,
          after: {
            userId: user.id,
            kind: input.kind,
            rule,
            endsAt: endsAt?.toISOString() ?? null
          },
          reason,
          meta
        },
        tx
      );
      await this.notifications.notify(
        {
          userId: user.id,
          type: input.kind === 'WARNING' ? 'forum.sanction.warning' : 'forum.sanction.suspension',
          title: input.kind === 'WARNING' ? 'Advertência no fórum' : 'Suspensão no fórum',
          message:
            input.kind === 'WARNING'
              ? `Sua participação no fórum quebrou a regra "${rule}": ${reason} Leia as regras do fórum para continuar participando. Se acontecer de novo, você pode ficar suspenso.`
              : `Você está suspenso do fórum ${endsAt ? `até ${when(endsAt)}` : 'até a diretoria liberar'} por quebrar a regra "${rule}": ${reason} Durante a suspensão, você lê o fórum, mas não publica, responde, edita nem reage.`,
          link: '/forum/regras',
          deduplicationKey: `forum.sanction:${row.id}`
        },
        tx
      );

      return row;
    });

    return this.view(created, now);
  }

  /** Libera antes do prazo (ou a suspensão sem prazo), com motivo. */
  async lift(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<SanctionView> {
    const clean = reason.trim();

    if (clean.length < 3) {
      throw AppError.validation('LIFT_REASON_REQUIRED', 'Diga por que está liberando.', [
        { field: 'reason', code: 'REQUIRED', message: 'Diga por que está liberando.' }
      ]);
    }

    const now = new Date();
    const lifted = await this.prisma.$transaction(async (tx) => {
      const row = await tx.forumSanction.findUnique({ where: { id }, include: SANCTION_INCLUDE });

      if (!row) {
        throw AppError.notFound('Suspensão não encontrada.');
      }

      if (!isActiveSuspension(row, now)) {
        throw AppError.conflict('NOT_ACTIVE', 'Esta suspensão já terminou ou foi liberada.');
      }

      // Liberar só preenche quem, quando e por quê; a suspensão continua no histórico.
      const updated = await tx.forumSanction.update({
        where: { id },
        data: { liftedAt: now, liftedById: actor.userId, liftReason: clean },
        include: SANCTION_INCLUDE
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'forum.sanction.lifted',
          entityType: 'ForumSanction',
          entityId: id,
          before: { endsAt: row.endsAt?.toISOString() ?? null },
          after: { liftedAt: now.toISOString() },
          reason: clean,
          meta
        },
        tx
      );
      await this.notifications.notify(
        {
          userId: row.userId,
          type: 'forum.sanction.lifted',
          title: 'Suspensão do fórum encerrada',
          message:
            'A diretoria encerrou a sua suspensão: você já pode publicar, responder e reagir no fórum. Continue seguindo as regras do fórum.',
          link: '/forum',
          deduplicationKey: `forum.sanction.lifted:${id}`
        },
        tx
      );

      return updated;
    });

    return this.view(lifted, now);
  }

  private view(row: SanctionRow, now: Date): SanctionView {
    return {
      id: row.id,
      kind: row.kind,
      user: { id: row.user.id, name: row.user.name },
      rule: row.rule,
      reason: row.reason,
      topicId: row.topicId,
      postId: row.postId,
      endsAt: row.endsAt?.toISOString() ?? null,
      active: isActiveSuspension(row, now),
      liftedAt: row.liftedAt?.toISOString() ?? null,
      liftedBy: row.liftedBy?.name ?? null,
      liftReason: row.liftReason,
      createdBy: row.createdBy.name,
      createdAt: row.createdAt.toISOString()
    };
  }
}
