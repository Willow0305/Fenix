import { Injectable } from '@nestjs/common';
import type { CardTemplate, Prisma } from '../../../generated/prisma/client';
import { dateToCivil, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import { type MoneyView } from '../../../common/domain/money';
import { AppError } from '../../../common/errors/app-error';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { SYSTEM_ROLES } from '../../access/domain/permission-catalog';
import { MediaService, mediaUrl } from '../../media/application/media.service';
import {
  CARD_STATE_LABELS,
  type CardState,
  cardState,
  DEFAULT_FEE_TOLERANCE_DAYS,
  feeOverdueBeyondTolerance,
  newCardCode,
  type CardKind
} from '../domain/card-rules';
import { type BenefitView, BenefitsService } from './benefits.service';

export const ADULT_AGE = 18;
export const PHOTO_LIMIT_BYTES = 400 * 1024;
export const CHECK_RETENTION_MS = 365 * 24 * 3_600_000;

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
  readonly type: CardKind;
  readonly state: CardState;
  readonly stateLabel: string;
  readonly holderName: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  /** Foto embutida (data URL): a tag `<img>` não envia o token de acesso. */
  readonly photo: string | null;
  readonly team: { name: string; logoUrl: string | null } | null;
  /** Cargo na diretoria, só na carteirinha de diretoria (DT-102). */
  readonly boardPosition: string | null;
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
    readonly type: CardKind;
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
  readonly type: CardKind;
  readonly state: CardState;
  readonly stateLabel: string;
  readonly holderName: string;
  readonly holderEmail: string | null;
  readonly hasAccount: boolean;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly version: number;
  readonly statusReason: string | null;
  /** Plano de afiliação comprado (nome no pedido); nulo na de atleta. */
  readonly plan: string | null;
}

/** Plano de afiliação na aba Afiliação: produto MEMBERSHIP da loja e quantos vendeu. */
export interface MembershipPlanRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
  readonly price: MoneyView;
  readonly promotionalPrice: MoneyView | null;
  readonly membershipMonths: number | null;
  readonly availableFrom: string | null;
  readonly availableUntil: string | null;
  readonly announcedAt: string | null;
  /** Carteirinhas deste plano valendo hoje. */
  readonly activeCards: number;
  /** Carteirinhas já emitidas por este plano (inclui vencidas e canceladas). */
  readonly issuedCards: number;
}

export interface CardsOverview {
  readonly athletes: { readonly valid: number };
  /** Carteirinhas de diretoria com status ativo (a saída da diretoria é conferida ao abrir). */
  readonly board: { readonly valid: number };
  readonly affiliates: {
    readonly valid: number;
    readonly suspended: number;
    readonly expiringSoon: number;
    readonly expired: number;
  };
  readonly benefits: {
    readonly inEffect: number;
    readonly total: number;
    /** Valendo hoje para cada tipo de carteirinha. */
    readonly athlete: number;
    readonly affiliate: number;
    readonly board: number;
  };
  readonly plans: readonly MembershipPlanRow[];
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

export const CARD_INCLUDE = {
  athlete: {
    select: {
      status: true,
      birthDate: true,
      publicProfileConsentAt: true,
      fullName: true,
      // Mensalidade em aberto mais antiga, para a suspensão por atraso (DT-101).
      monthlyFees: {
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { dueDate: true }
      },
      teamMemberships: {
        where: { status: 'ACTIVE', endsOn: null, team: { deletedAt: null } },
        select: { team: { select: { name: true, logoMediaFileId: true } } },
        take: 1
      }
    }
  },
  holderUser: {
    select: {
      avatarMediaFileId: true,
      status: true,
      deletedAt: true,
      boardPosition: true,
      // Papel Diretoria da pessoa (DT-077): a validade é conferida em `boardActive`.
      userRoles: {
        where: { role: { code: SYSTEM_ROLES.board, deletedAt: null } },
        select: { expiresAt: true }
      }
    }
  },
  orderItem: { select: { productName: true } }
} satisfies Prisma.MemberCardInclude;

export type CardRow = Prisma.MemberCardGetPayload<{ include: typeof CARD_INCLUDE }>;

/** A pessoa ainda é da diretoria? Conta ativa e papel Diretoria sem validade vencida. */
export function boardActive(user: CardRow['holderUser']): boolean {
  const now = new Date();

  return (
    user !== null &&
    user.status === 'ACTIVE' &&
    user.deletedAt === null &&
    user.userRoles.some((role) => role.expiresAt === null || role.expiresAt > now)
  );
}

/** Regra da suspensão por mensalidade atrasada (DT-101). */
export interface CardFeeRule {
  readonly toleranceDays: number;
}

/**
 * Leitura das carteirinhas (DT-068, DT-101): visual, situação (válida, vencida, suspensa por
 * mensalidade), visão da carteirinha e "Minhas carteirinhas", criando as de atleta e diretoria
 * que ainda não existem (PEN-077).
 */
@Injectable()
export class MemberCardReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly benefits: BenefitsService
  ) {}

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

  /** Dias de tolerância depois do vencimento antes de suspender a carteirinha de atleta. */
  async feeToleranceDays(): Promise<number> {
    const settings = await this.prisma.teamSettings.findFirst({
      select: { cardFeeToleranceDays: true }
    });

    return settings?.cardFeeToleranceDays ?? DEFAULT_FEE_TOLERANCE_DAYS;
  }

  async feeRule(): Promise<CardFeeRule> {
    return { toleranceDays: await this.feeToleranceDays() };
  }

  stateOf(row: CardRow, today: string, toleranceDays: number): CardState {
    const oldestDue = row.athlete?.monthlyFees[0]?.dueDate ?? null;

    return cardState(
      {
        type: row.type,
        status: row.status,
        deleted: row.deletedAt !== null,
        startsOn: optionalCivil(row.startsOn),
        endsOn: optionalCivil(row.endsOn),
        athleteStatus: row.athlete?.status ?? null,
        boardActive: boardActive(row.holderUser),
        feeOverdue: feeOverdueBeyondTolerance(
          oldestDue ? dateToCivil(oldestDue) : null,
          today,
          toleranceDays
        )
      },
      today
    );
  }

  async photo(mediaFileId: string | null | undefined): Promise<string | null> {
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

  async view(row: CardRow, today: string, viewerId: string | null): Promise<CardView> {
    const state = this.stateOf(row, today, await this.feeToleranceDays());
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
      boardPosition: row.type === 'BOARD' ? (row.holderUser?.boardPosition ?? null) : null,
      purchasedForOther: viewerId !== null && row.holderUserId !== viewerId,
      benefits: state === 'VALID' ? await this.benefits.forCard(row.type, today) : []
    };
  }

  async loadOwned(userId: string, id: string): Promise<CardRow> {
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

  /** Atleta ativo sem carteirinha ganha uma (gratuita, DT-068 A). */
  /** Carteirinhas gratuitas: atletas ativos e quem tem o papel Diretoria (DT-068, DT-077). */
  async ensureFreeCards(): Promise<void> {
    await this.ensureAthleteCards();
    await this.ensureBoardCards();
  }

  /**
   * Diretoria (DT-077): uma carteirinha por pessoa com o papel Diretoria e conta ativa, criada
   * na primeira vez; se a pessoa sai da diretoria ela deixa de valer (e volta se o papel voltar).
   */
  async ensureBoardCards(): Promise<number> {
    const missing = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        memberCards: { none: { type: 'BOARD' } },
        userRoles: {
          some: {
            role: { code: SYSTEM_ROLES.board, deletedAt: null },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        }
      },
      select: { id: true, name: true, email: true },
      take: 200
    });

    if (missing.length === 0) {
      return 0;
    }

    const { count } = await this.prisma.memberCard.createMany({
      data: missing.map((user) => ({
        code: newCardCode(),
        type: 'BOARD' as const,
        holderUserId: user.id,
        holderName: user.name,
        holderEmail: user.email
      })),
      skipDuplicates: true
    });

    return count;
  }

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

  async myCards(userId: string): Promise<MyCardsView> {
    const own = await this.prisma.athlete.findFirst({
      where: { userId, deletedAt: null, status: 'ACTIVE', memberCard: null },
      select: { id: true }
    });

    if (own) {
      await this.ensureAthleteCards();
    }

    await this.ensureBoardCards();

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

  adminRow(
    row: CardRow & { holderEmail: string | null },
    today: string,
    toleranceDays: number
  ): CardAdminRow {
    const state = this.stateOf(row, today, toleranceDays);

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
      statusReason: row.statusReason,
      plan: row.orderItem?.productName ?? null
    };
  }
}
