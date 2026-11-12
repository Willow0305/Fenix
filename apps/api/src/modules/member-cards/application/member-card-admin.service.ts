import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { CardTemplate, Prisma } from '../../../generated/prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import {
  civilToDate,
  dateToCivil,
  optionalCivil,
  todayIn
} from '../../../common/domain/civil-date';
import { moneyView } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { defaultSettingsData, SETTINGS_KEY } from '../../settings/application/settings.service';
import { CARD_STATE_LABELS, type CardState, type CardKind } from '../domain/card-rules';
import { BenefitsService } from './benefits.service';
import {
  CardDesign,
  CardAdminRow,
  CardsOverview,
  CardAdminDetail,
  CARD_INCLUDE,
  CardFeeRule
} from './member-card-view';
import { MemberCardValidationService } from './member-card-validation.service';
import { AffiliationCardsService } from './affiliation-cards.service';
import { MemberCardReader } from './member-card-view';

/**
 * Carteirinhas no painel (DT-068, DT-101): visual, regra da mensalidade atrasada, suspensão
 * automática, visão geral, lista, ficha e mudança de situação. Agenda as tarefas automáticas.
 */
@Injectable()
export class MemberCardAdminService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly benefits: BenefitsService,
    private readonly jobs: JobScheduler,
    private readonly notifications: NotificationsService,
    private readonly validation: MemberCardValidationService,
    private readonly affiliations: AffiliationCardsService,
    private readonly reader: MemberCardReader
  ) {}

  onModuleInit(): void {
    // Conferências ficam 12 meses (DT-068 G).
    this.jobs.every('cards.checks.purge', 24 * 3_600_000, async () => {
      await this.validation.purgeChecks();
    });
    // Carteirinha de atleta suspensa por mensalidade atrasada e liberada ao pagar (DT-101).
    this.jobs.every('cards.fee.sync', 3_600_000, async () => {
      await this.syncFeeBlocks();
    });
    // Aviso 15 dias antes de a afiliação vencer (DT-068).
    this.jobs.every('cards.expiry.notice', 6 * 3_600_000, async () => {
      await this.affiliations.noticeExpiring();
    });
  }

  async setDesign(
    actor: Principal,
    input: { template: CardTemplate; useTeamLogo: boolean },
    meta: RequestMeta
  ): Promise<CardDesign> {
    const settings = await this.prisma.teamSettings.findFirst({ select: { id: true } });

    if (settings === null) {
      throw AppError.notFound('Configurações do time não encontradas.');
    }

    await this.prisma.teamSettings.update({
      where: { id: settings.id },
      data: { cardTemplate: input.template, cardUseTeamLogo: input.useTeamLogo }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'cards.design.updated',
      entityType: 'TeamSettings',
      entityId: settings.id,
      after: input,
      meta
    });

    return this.reader.design();
  }

  async setFeeRule(actor: Principal, input: CardFeeRule, meta: RequestMeta): Promise<CardFeeRule> {
    // Configuração única do time; criada com os padrões se ainda não existir.
    const settings = await this.prisma.teamSettings.upsert({
      where: { singletonKey: SETTINGS_KEY },
      create: defaultSettingsData(),
      update: {},
      select: { id: true, cardFeeToleranceDays: true }
    });

    await this.prisma.teamSettings.update({
      where: { id: settings.id },
      data: { cardFeeToleranceDays: input.toleranceDays }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'cards.fee_rule.updated',
      entityType: 'TeamSettings',
      entityId: settings.id,
      before: { toleranceDays: settings.cardFeeToleranceDays },
      after: { toleranceDays: input.toleranceDays },
      meta
    });
    // A conferência já usa o prazo novo; a rotina acerta os avisos agora mesmo.
    await this.syncFeeBlocks();

    return this.reader.feeRule();
  }

  /**
   * Registra quando a carteirinha de atleta passa a ficar suspensa por atraso ou volta a
   * valer (DT-101): auditoria e aviso ao atleta, uma vez por mudança. A situação em si é
   * sempre calculada na hora (pagou, voltou); esta rotina só marca a passagem.
   */
  async syncFeeBlocks(now: Date = new Date()): Promise<{ blocked: number; released: number }> {
    const today = todayIn(undefined, now);
    const toleranceDays = await this.reader.feeToleranceDays();
    const rows = await this.prisma.memberCard.findMany({
      where: { type: 'ATHLETE', deletedAt: null },
      include: CARD_INCLUDE
    });
    let blocked = 0;
    let released = 0;

    for (const row of rows) {
      const overdue = this.reader.stateOf(row, today, toleranceDays) === 'FEE_OVERDUE';

      if (overdue === (row.feeBlockedAt !== null)) {
        continue;
      }

      const changed = await this.prisma.memberCard.updateMany({
        where: { id: row.id, feeBlockedAt: overdue ? null : { not: null } },
        data: { feeBlockedAt: overdue ? now : null }
      });

      if (changed.count === 0) {
        continue;
      }

      const oldestDue = row.athlete?.monthlyFees[0]?.dueDate;

      await this.audit.record({
        actorUserId: null,
        action: overdue ? 'cards.fee_blocked' : 'cards.fee_released',
        entityType: 'MemberCard',
        entityId: row.id,
        reason: overdue
          ? `Mensalidade atrasada há mais de ${toleranceDays} dias`
          : 'Mensalidade em dia',
        before: { feeBlocked: !overdue },
        after: {
          feeBlocked: overdue,
          ...(overdue && oldestDue ? { oldestDueOn: dateToCivil(oldestDue) } : {})
        }
      });

      if (row.holderUserId) {
        await this.notifications.notify(
          overdue
            ? {
                userId: row.holderUserId,
                type: 'fee.card_blocked',
                title: 'Carteirinha suspensa por mensalidade atrasada',
                message:
                  'Sua carteirinha de atleta ficou suspensa porque há mensalidade atrasada. Ela volta a valer assim que a mensalidade for paga.',
                link: '/minha-conta/mensalidades',
                deduplicationKey: `card-fee-blocked:${row.id}:${now.toISOString()}`
              }
            : {
                userId: row.holderUserId,
                type: 'fee.card_released',
                title: 'Carteirinha valendo de novo',
                message: 'Mensalidade em dia: sua carteirinha de atleta voltou a valer.',
                link: '/minha-conta/carteirinhas',
                deduplicationKey: `card-fee-released:${row.id}:${now.toISOString()}`
              }
        );
      }

      if (overdue) {
        blocked += 1;
      } else {
        released += 1;
      }
    }

    return { blocked, released };
  }

  /** Visão geral da aba Afiliação: números, planos e benefícios (DT-072). */
  async overview(): Promise<CardsOverview> {
    await this.reader.ensureFreeCards();

    const today = todayIn();
    const todayDate = civilToDate(today);
    const in15 = new Date(todayDate.getTime() + 15 * 86_400_000);
    const valid: Prisma.MemberCardWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      OR: [{ endsOn: null }, { endsOn: { gte: todayDate } }]
    };
    const affiliate = { type: 'AFFILIATE' as const };
    const [
      athletes,
      boardCards,
      affiliates,
      suspended,
      expiringSoon,
      expired,
      benefitsTotal,
      products
    ] = await this.prisma.$transaction([
      // Sem as suspensas por mensalidade atrasada, marcadas pela rotina (DT-101).
      this.prisma.memberCard.count({ where: { ...valid, type: 'ATHLETE', feeBlockedAt: null } }),
      this.prisma.memberCard.count({ where: { ...valid, type: 'BOARD' } }),
      this.prisma.memberCard.count({ where: { ...valid, ...affiliate } }),
      this.prisma.memberCard.count({
        where: { ...affiliate, status: 'SUSPENDED', deletedAt: null }
      }),
      this.prisma.memberCard.count({
        where: {
          ...affiliate,
          status: 'ACTIVE',
          deletedAt: null,
          endsOn: { gte: todayDate, lte: in15 }
        }
      }),
      this.prisma.memberCard.count({
        where: { ...affiliate, status: 'ACTIVE', deletedAt: null, endsOn: { lt: todayDate } }
      }),
      this.prisma.partnerBenefit.count({ where: { deletedAt: null } }),
      this.prisma.product.findMany({
        where: { fulfillmentType: 'MEMBERSHIP', deletedAt: null, status: { not: 'ARCHIVED' } },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          basePrice: true,
          promotionalPrice: true,
          currency: true,
          membershipMonths: true,
          availableFrom: true,
          availableUntil: true,
          membershipAnnouncedAt: true
        }
      })
    ]);
    const benefitsInEffect = await this.benefits.countInEffect(today);
    const byType = await this.benefits.countInEffectByType(today);
    const plans = await Promise.all(
      products.map(async (product) => {
        const ofPlan = { ...affiliate, orderItem: { productId: product.id } };
        const [activeCards, issuedCards] = await this.prisma.$transaction([
          this.prisma.memberCard.count({ where: { ...valid, ...ofPlan } }),
          this.prisma.memberCard.count({ where: ofPlan })
        ]);

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          price: moneyView(product.basePrice, product.currency),
          promotionalPrice: product.promotionalPrice
            ? moneyView(product.promotionalPrice, product.currency)
            : null,
          membershipMonths: product.membershipMonths,
          availableFrom: product.availableFrom?.toISOString() ?? null,
          availableUntil: product.availableUntil?.toISOString() ?? null,
          announcedAt: product.membershipAnnouncedAt?.toISOString() ?? null,
          activeCards,
          issuedCards
        };
      })
    );

    return {
      athletes: { valid: athletes },
      board: { valid: boardCards },
      affiliates: { valid: affiliates, suspended, expiringSoon, expired },
      benefits: { inEffect: benefitsInEffect, total: benefitsTotal, ...byType },
      plans
    };
  }

  async list(
    query: PageQueryDto & {
      type?: CardKind;
      situation?: 'valid' | 'suspended' | 'expired' | 'cancelled';
      planId?: string;
    }
  ): Promise<Page<CardAdminRow>> {
    await this.reader.ensureFreeCards();

    const { skip, take, page, pageSize } = pageArgs(query);
    const today = civilToDate(todayIn());
    const situation: Prisma.MemberCardWhereInput =
      query.situation === 'suspended'
        ? { status: 'SUSPENDED', deletedAt: null }
        : query.situation === 'cancelled'
          ? { OR: [{ status: 'CANCELLED' }, { deletedAt: { not: null } }] }
          : query.situation === 'expired'
            ? { status: 'ACTIVE', deletedAt: null, endsOn: { lt: today } }
            : query.situation === 'valid'
              ? {
                  status: 'ACTIVE',
                  deletedAt: null,
                  OR: [{ endsOn: null }, { endsOn: { gte: today } }]
                }
              : {};
    const search = query.search?.trim();
    const where: Prisma.MemberCardWhereInput = {
      ...situation,
      ...(query.type ? { type: query.type } : {}),
      ...(query.planId ? { orderItem: { productId: query.planId } } : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { holderName: { contains: search, mode: 'insensitive' } },
                  { code: { contains: search.toUpperCase() } },
                  { athlete: { fullName: { contains: search, mode: 'insensitive' } } }
                ]
              }
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.memberCard.findMany({
        where,
        include: CARD_INCLUDE,
        orderBy: [{ type: 'asc' }, { holderName: 'asc' }],
        skip,
        take
      }),
      this.prisma.memberCard.count({ where })
    ]);
    const civilToday = todayIn();
    const toleranceDays = await this.reader.feeToleranceDays();

    return toPage(
      rows.map((row) => this.reader.adminRow(row, civilToday, toleranceDays)),
      total,
      page,
      pageSize
    );
  }

  async detail(id: string): Promise<CardAdminDetail> {
    const row = await this.prisma.memberCard.findUnique({ where: { id }, include: CARD_INCLUDE });

    if (row === null) {
      throw AppError.notFound('Carteirinha não encontrada.');
    }

    const checks = await this.prisma.memberCardCheck.findMany({
      where: { cardId: id },
      orderBy: { checkedAt: 'desc' },
      take: 50
    });

    return {
      ...this.reader.adminRow(row, todayIn(), await this.reader.feeToleranceDays()),
      checks: checks.map((c) => ({
        checkedAt: c.checkedAt.toISOString(),
        valid: c.valid,
        reason: c.reason ? (CARD_STATE_LABELS[c.reason as CardState] ?? c.reason) : null,
        byStaff: c.byStaff,
        printed: c.printed
      }))
    };
  }

  /** Suspender, reativar, cancelar, reemitir, estender ou corrigir nome; sempre com motivo. */
  async change(
    actor: Principal,
    id: string,
    action: 'suspend' | 'reactivate' | 'cancel' | 'reissue' | 'extend' | 'rename',
    input: { reason: string; endsOn?: string; holderName?: string },
    meta: RequestMeta
  ): Promise<CardAdminDetail> {
    await this.prisma.$transaction(async (tx) => {
      const card = await tx.memberCard.findFirst({ where: { id, deletedAt: null } });

      if (card === null) {
        throw AppError.notFound('Carteirinha não encontrada.');
      }

      if (card.status === 'CANCELLED' && action !== 'reissue') {
        throw AppError.conflict('CARD_CANCELLED', 'Carteirinha cancelada não pode ser alterada.');
      }

      let data: Prisma.MemberCardUpdateInput;

      switch (action) {
        case 'suspend':
          if (card.status === 'SUSPENDED') {
            throw AppError.conflict('ALREADY_SUSPENDED', 'A carteirinha já está suspensa.');
          }

          data = { status: 'SUSPENDED', statusReason: input.reason };
          break;
        case 'reactivate':
          if (card.status !== 'SUSPENDED') {
            throw AppError.conflict('NOT_SUSPENDED', 'Só carteirinha suspensa pode ser reativada.');
          }

          data = { status: 'ACTIVE', statusReason: null };
          break;
        case 'cancel':
          data = { status: 'CANCELLED', statusReason: input.reason };
          break;
        case 'reissue':
          if (card.status === 'CANCELLED') {
            throw AppError.conflict(
              'CARD_CANCELLED',
              'Carteirinha cancelada não pode ser reemitida.'
            );
          }

          data = { version: { increment: 1 } };
          break;
        case 'extend': {
          if (card.type !== 'AFFILIATE' || !input.endsOn) {
            throw AppError.validation('INVALID_EXTEND', 'Informe a nova data final da afiliação.');
          }

          const current = optionalCivil(card.endsOn);

          if (current !== null && input.endsOn <= current) {
            throw AppError.validation('INVALID_EXTEND', 'A nova data precisa ser depois da atual.');
          }

          data = { endsOn: civilToDate(input.endsOn) };
          break;
        }
        case 'rename':
          if (card.type !== 'AFFILIATE' || !input.holderName?.trim()) {
            throw AppError.validation(
              'INVALID_NAME',
              'Só o nome do beneficiário de afiliação pode ser corrigido.'
            );
          }

          data = { holderName: input.holderName.trim() };
          break;
      }

      const updated = await tx.memberCard.update({ where: { id }, data });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: `cards.${action}`,
          entityType: 'MemberCard',
          entityId: id,
          reason: input.reason,
          before: {
            status: card.status,
            version: card.version,
            endsOn: optionalCivil(card.endsOn),
            holderName: card.holderName
          },
          after: {
            status: updated.status,
            version: updated.version,
            endsOn: optionalCivil(updated.endsOn),
            holderName: updated.holderName
          },
          meta
        },
        tx
      );
    });

    return this.detail(id);
  }
}
