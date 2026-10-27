import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { CardTemplate, Prisma } from '../../../generated/prisma/client';
import QRCode from 'qrcode';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { ageOn, civilToDate, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { JobScheduler } from '../../../common/jobs/job-scheduler';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { MediaService, mediaUrl } from '../../media/application/media.service';
import {
  CARD_STATE_LABELS,
  type CardState,
  cardState,
  newCardCode,
  publicStateLabel,
  shortName
} from '../domain/card-rules';
import {
  cardKey,
  liveValidUntil,
  msToNextWindow,
  signLiveToken,
  signPrintedToken,
  verifyCardToken
} from '../domain/card-token';
import { type BenefitView, BenefitsService } from './benefits.service';

const ADULT_AGE = 18;
const PHOTO_LIMIT_BYTES = 400 * 1024;
const CHECK_RETENTION_MS = 365 * 24 * 3_600_000;

export interface CardDesign {
  readonly template: CardTemplate;
  readonly useTeamLogo: boolean;
  readonly teamName: string;
  readonly officialLogoUrl: string | null;
  readonly backgroundUrl: string | null;
}

export interface CardView {
  readonly id: string;
  readonly code: string;
  readonly type: 'ATHLETE' | 'AFFILIATE';
  readonly state: CardState;
  readonly stateLabel: string;
  readonly holderName: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  /** Foto embutida (data URL): a tag `<img>` não envia o token de acesso. */
  readonly photo: string | null;
  readonly team: { name: string; logoUrl: string | null } | null;
  /** Comprada para outra pessoa que ainda não tem conta (DT-068, afiliação). */
  readonly purchasedForOther: boolean;
  readonly benefits: readonly BenefitView[];
}

export interface MyCardsView {
  readonly design: CardDesign;
  readonly cards: readonly CardView[];
}

export interface CardQr {
  readonly qrSvg: string;
  readonly validUntil: string | null;
  readonly refreshInMs: number | null;
}

export interface PublicValidation {
  readonly valid: boolean;
  readonly label: string;
  readonly checkedAt: string;
  readonly card: {
    readonly type: 'ATHLETE' | 'AFFILIATE';
    readonly name: string;
    readonly photo: string | null;
    /** Menor sem autorização do responsável: confira documento. */
    readonly minorWithoutPhoto: boolean;
    readonly endsOn: string | null;
    readonly benefits: readonly BenefitView[];
  } | null;
}

export interface StaffValidation {
  readonly valid: boolean;
  readonly state: CardState | 'UNKNOWN';
  readonly label: string;
  readonly checkedAt: string;
  readonly card: (CardView & { feesUpToDate: boolean | null; athleteStatus: string | null }) | null;
}

export interface CardAdminRow {
  readonly id: string;
  readonly code: string;
  readonly type: 'ATHLETE' | 'AFFILIATE';
  readonly state: CardState;
  readonly stateLabel: string;
  readonly holderName: string;
  readonly holderEmail: string | null;
  readonly hasAccount: boolean;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly version: number;
  readonly statusReason: string | null;
}

export interface CardAdminDetail extends CardAdminRow {
  readonly checks: readonly {
    checkedAt: string;
    valid: boolean;
    reason: string | null;
    byStaff: boolean;
    printed: boolean;
  }[];
}

const CARD_INCLUDE = {
  athlete: {
    select: {
      status: true,
      birthDate: true,
      publicProfileConsentAt: true,
      fullName: true,
      teamMemberships: {
        where: { status: 'ACTIVE', endsOn: null, team: { deletedAt: null } },
        select: { team: { select: { name: true, logoMediaFileId: true } } },
        take: 1
      }
    }
  },
  holderUser: { select: { avatarMediaFileId: true } }
} satisfies Prisma.MemberCardInclude;

type CardRow = Prisma.MemberCardGetPayload<{ include: typeof CARD_INCLUDE }>;

/** Carteirinha digital (DT-068): emissão, QR, conferência e administração. */
@Injectable()
export class CardsService implements OnModuleInit {
  private readonly key: Buffer;
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly benefits: BenefitsService,
    private readonly jobs: JobScheduler,
    config: AppConfig
  ) {
    this.key = cardKey(config.values.dataEncryptionKey);
    this.webOrigin = config.values.webOrigin.replace(/\/$/, '');
  }

  onModuleInit(): void {
    // Conferências ficam 12 meses (DT-068 G).
    this.jobs.every('cards.checks.purge', 24 * 3_600_000, async () => {
      await this.purgeChecks();
    });
  }

  async purgeChecks(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.memberCardCheck.deleteMany({
      where: { checkedAt: { lt: new Date(now.getTime() - CHECK_RETENTION_MS) } }
    });

    return count;
  }

  // ---------- Visual ----------

  async design(): Promise<CardDesign> {
    const settings = await this.prisma.teamSettings.findFirst({
      select: {
        teamName: true,
        cardTemplate: true,
        cardUseTeamLogo: true,
        brandAssets: {
          where: { context: { in: ['OFFICIAL', 'CARD_BACKGROUND'] } },
          select: { context: true, mediaFileId: true }
        }
      }
    });
    const asset = (context: string) =>
      settings?.brandAssets.find((a) => a.context === context)?.mediaFileId ?? null;
    const official = asset('OFFICIAL');
    const background = asset('CARD_BACKGROUND');

    return {
      template: settings?.cardTemplate ?? 'CLASSIC',
      useTeamLogo: settings?.cardUseTeamLogo ?? true,
      teamName: settings?.teamName ?? 'Fênix Vôlei',
      officialLogoUrl: official ? mediaUrl(official) : null,
      backgroundUrl: background ? mediaUrl(background) : null
    };
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

    return this.design();
  }

  // ---------- Emissão ----------

  /** Atleta ativo sem carteirinha ganha uma (gratuita, DT-068 A). */
  async ensureAthleteCards(tx: PrismaTx | PrismaService = this.prisma): Promise<number> {
    const missing = await tx.athlete.findMany({
      where: { status: 'ACTIVE', deletedAt: null, memberCard: null },
      select: { id: true, fullName: true, userId: true },
      take: 500
    });

    if (missing.length === 0) {
      return 0;
    }

    const { count } = await tx.memberCard.createMany({
      data: missing.map((athlete) => ({
        code: newCardCode(),
        type: 'ATHLETE' as const,
        athleteId: athlete.id,
        holderUserId: athlete.userId,
        holderName: athlete.fullName
      })),
      skipDuplicates: true
    });

    return count;
  }

  /** Carteirinha comprada para este e-mail passa para a conta que o confirmou. */
  private async linkByEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true }
    });

    if (!user?.email || user.emailVerifiedAt === null) {
      return;
    }

    await this.prisma.memberCard.updateMany({
      where: {
        holderUserId: null,
        holderEmail: { equals: user.email, mode: 'insensitive' },
        deletedAt: null
      },
      data: { holderUserId: userId }
    });
  }

  // ---------- Leitura ----------

  private stateOf(row: CardRow, today: string): CardState {
    return cardState(
      {
        type: row.type,
        status: row.status,
        deleted: row.deletedAt !== null,
        startsOn: optionalCivil(row.startsOn),
        endsOn: optionalCivil(row.endsOn),
        athleteStatus: row.athlete?.status ?? null
      },
      today
    );
  }

  private async photo(mediaFileId: string | null | undefined): Promise<string | null> {
    if (!mediaFileId) {
      return null;
    }

    try {
      const file = await this.media.read(mediaFileId, undefined, true);

      return file.content.length <= PHOTO_LIMIT_BYTES
        ? `data:${file.mimeType};base64,${file.content.toString('base64')}`
        : null;
    } catch {
      return null;
    }
  }

  private async view(row: CardRow, today: string, viewerId: string | null): Promise<CardView> {
    const state = this.stateOf(row, today);
    const team = row.athlete?.teamMemberships[0]?.team ?? null;

    return {
      id: row.id,
      code: row.code,
      type: row.type,
      state,
      stateLabel: CARD_STATE_LABELS[state],
      holderName: row.athlete?.fullName ?? row.holderName,
      startsOn: optionalCivil(row.startsOn),
      endsOn: optionalCivil(row.endsOn),
      photo: await this.photo(row.holderUser?.avatarMediaFileId),
      team: team
        ? { name: team.name, logoUrl: team.logoMediaFileId ? mediaUrl(team.logoMediaFileId) : null }
        : null,
      purchasedForOther: viewerId !== null && row.holderUserId !== viewerId,
      benefits: state === 'VALID' ? await this.benefits.forCard(row.type, today) : []
    };
  }

  private async loadOwned(userId: string, id: string): Promise<CardRow> {
    const row = await this.prisma.memberCard.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ holderUserId: userId }, { holderUserId: null, purchasedByUserId: userId }]
      },
      include: CARD_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Carteirinha não encontrada.');
    }

    return row;
  }

  async myCards(userId: string): Promise<MyCardsView> {
    const own = await this.prisma.athlete.findFirst({
      where: { userId, deletedAt: null, status: 'ACTIVE', memberCard: null },
      select: { id: true }
    });

    if (own) {
      await this.ensureAthleteCards();
    }

    await this.linkByEmail(userId);

    const today = todayIn();
    const rows = await this.prisma.memberCard.findMany({
      where: {
        deletedAt: null,
        status: { not: 'CANCELLED' },
        OR: [{ holderUserId: userId }, { holderUserId: null, purchasedByUserId: userId }]
      },
      include: CARD_INCLUDE,
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }]
    });

    return {
      design: await this.design(),
      cards: await Promise.all(rows.map((row) => this.view(row, today, userId)))
    };
  }

  /** QR do celular: muda a cada minuto; só para carteirinha válida. */
  async liveQr(userId: string, id: string, now: Date = new Date()): Promise<CardQr> {
    const row = await this.loadOwned(userId, id);

    if (this.stateOf(row, todayIn()) !== 'VALID') {
      throw AppError.conflict('CARD_NOT_VALID', 'Esta carteirinha não está válida.');
    }

    return {
      qrSvg: await this.qr(signLiveToken(this.key, row.id, row.version, now)),
      validUntil: liveValidUntil(now).toISOString(),
      refreshInMs: msToNextWindow(now)
    };
  }

  /** QR fixo do impresso: vale até a próxima reemissão (DT-068, impressão). */
  async printed(userId: string, id: string): Promise<CardView & CardQr & { design: CardDesign }> {
    const row = await this.loadOwned(userId, id);
    const today = todayIn();

    if (this.stateOf(row, today) !== 'VALID') {
      throw AppError.conflict('CARD_NOT_VALID', 'Só é possível imprimir carteirinha válida.');
    }

    return {
      ...(await this.view(row, today, userId)),
      design: await this.design(),
      qrSvg: await this.qr(signPrintedToken(this.key, row.id, row.version)),
      validUntil: null,
      refreshInMs: null
    };
  }

  private qr(token: string): Promise<string> {
    return QRCode.toString(`${this.webOrigin}/validar/${token}`, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1
    });
  }

  // ---------- Conferência ----------

  private async resolve(
    token: string,
    now: Date
  ): Promise<{
    row: CardRow | null;
    state: CardState | 'UNKNOWN';
    printed: boolean;
    expiredCode: boolean;
  }> {
    const parsed = verifyCardToken(this.key, token.slice(0, 200), now);

    if ('error' in parsed) {
      return {
        row: null,
        state: 'UNKNOWN',
        printed: false,
        expiredCode: parsed.error === 'EXPIRED'
      };
    }

    const row = await this.prisma.memberCard.findUnique({
      where: { id: parsed.cardId },
      include: CARD_INCLUDE
    });

    if (row === null) {
      return { row: null, state: 'UNKNOWN', printed: parsed.printed, expiredCode: false };
    }

    const state = row.version !== parsed.version ? 'REPLACED' : this.stateOf(row, todayIn());

    return { row, state, printed: parsed.printed, expiredCode: false };
  }

  private async recordCheck(
    cardId: string,
    state: CardState,
    byStaff: boolean,
    printed: boolean
  ): Promise<void> {
    await this.prisma.memberCardCheck.create({
      data: {
        cardId,
        valid: state === 'VALID',
        reason: state === 'VALID' ? null : state,
        byStaff,
        printed
      }
    });
  }

  /** Quem confere sem login (parceiro): o mínimo para conferir e os benefícios (DT-068 C). */
  async validatePublic(token: string, now: Date = new Date()): Promise<PublicValidation> {
    const checkedAt = now.toISOString();
    const { row, state, printed, expiredCode } = await this.resolve(token, now);

    if (row === null || state === 'UNKNOWN') {
      return {
        valid: false,
        label: expiredCode
          ? 'Código vencido: peça para abrir a carteirinha de novo (o QR muda a cada minuto).'
          : 'Inválida',
        checkedAt,
        card: null
      };
    }

    await this.recordCheck(row.id, state, false, printed);

    if (state !== 'VALID') {
      return { valid: false, label: publicStateLabel(state), checkedAt, card: null };
    }

    const today = todayIn();
    const birth = optionalCivil(row.athlete?.birthDate);
    const minor = birth !== null && ageOn(birth, today) < ADULT_AGE;
    const showPhoto = !minor || row.athlete?.publicProfileConsentAt != null;
    const name = row.athlete?.fullName ?? row.holderName;

    return {
      valid: true,
      label: 'Válida',
      checkedAt,
      card: {
        type: row.type,
        name: shortName(name, minor && !showPhoto),
        photo: showPhoto ? await this.photo(row.holderUser?.avatarMediaFileId) : null,
        minorWithoutPhoto: minor && !showPhoto,
        endsOn: optionalCivil(row.endsOn),
        benefits: await this.benefits.forCard(row.type, today)
      }
    };
  }

  /** Diretoria logada: situação completa e, com permissão, mensalidade em dia. */
  async validateStaff(
    principal: Principal,
    token: string,
    meta: RequestMeta,
    now: Date = new Date()
  ): Promise<StaffValidation> {
    const checkedAt = now.toISOString();
    const { row, state, printed, expiredCode } = await this.resolve(token, now);

    if (row === null || state === 'UNKNOWN') {
      return {
        valid: false,
        state: 'UNKNOWN',
        label: expiredCode
          ? 'Código vencido: peça para abrir a carteirinha de novo (o QR muda a cada minuto).'
          : 'Código inválido: não é uma carteirinha do clube.',
        checkedAt,
        card: null
      };
    }

    await this.recordCheck(row.id, state, true, printed);
    await this.audit.record({
      actorUserId: principal.userId,
      action: 'cards.checked',
      entityType: 'MemberCard',
      entityId: row.id,
      after: { state, printed },
      meta
    });

    const today = todayIn();
    const feesUpToDate =
      row.athleteId && principal.permissions.has(PERMISSIONS.feesRead)
        ? (await this.prisma.monthlyFee.count({
            where: {
              athleteId: row.athleteId,
              status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] },
              dueDate: { lt: civilToDate(today) }
            }
          })) === 0
        : null;

    return {
      valid: state === 'VALID',
      state,
      label: CARD_STATE_LABELS[state],
      checkedAt,
      card: {
        ...(await this.view(row, today, null)),
        feesUpToDate,
        athleteStatus: row.athlete?.status ?? null
      }
    };
  }

  // ---------- Administração ----------

  private adminRow(row: CardRow & { holderEmail: string | null }, today: string): CardAdminRow {
    const state = this.stateOf(row, today);

    return {
      id: row.id,
      code: row.code,
      type: row.type,
      state,
      stateLabel: CARD_STATE_LABELS[state],
      holderName: row.athlete?.fullName ?? row.holderName,
      holderEmail: row.holderEmail,
      hasAccount: row.holderUserId !== null,
      startsOn: optionalCivil(row.startsOn),
      endsOn: optionalCivil(row.endsOn),
      version: row.version,
      statusReason: row.statusReason
    };
  }

  async list(
    query: PageQueryDto & {
      type?: 'ATHLETE' | 'AFFILIATE';
      situation?: 'valid' | 'suspended' | 'expired' | 'cancelled';
    }
  ): Promise<Page<CardAdminRow>> {
    await this.ensureAthleteCards();

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

    return toPage(
      rows.map((row) => this.adminRow(row, civilToday)),
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
      ...this.adminRow(row, todayIn()),
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
