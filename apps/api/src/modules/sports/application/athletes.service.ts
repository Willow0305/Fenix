import { Injectable } from '@nestjs/common';
import { isValidCpf, maskCpf } from '@fenix/validation';
import type { AthleteStatus, Gender, Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { decryptField, encryptField } from '../../../common/crypto/data-cipher';
import { sha256Hex } from '../../../common/crypto/tokens';
import {
  ageOn,
  civilToDate,
  dateToCivil,
  monthStart,
  optionalCivil,
  todayIn
} from '../../../common/domain/civil-date';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { SYSTEM_ROLES } from '../../access/domain/permission-catalog';
import { normalizeEmail } from '../../auth/domain/auth-rules';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  ADULT_AGE,
  ATHLETE_STATUS_LABELS,
  ATHLETE_TRANSITIONS,
  normalizeDocument,
  normalizeName,
  periodsOverlap,
  validateGuardian
} from '../domain/sports-rules';
import { mediaUrl } from '../../media/application/media.service';

export interface AthleteInput {
  readonly fullName: string;
  readonly preferredName?: string | null;
  readonly birthDate?: string | null;
  readonly documentNumber?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly gender?: Gender | null;
  readonly position?: string | null;
  readonly emergencyContactName?: string | null;
  readonly emergencyContactPhone?: string | null;
  readonly guardianName?: string | null;
  readonly guardianPhone?: string | null;
  readonly guardianAcknowledged?: boolean;
  readonly notes?: string | null;
}

export interface MembershipView {
  readonly id: string;
  readonly team: { id: string; name: string; type: string };
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly position: string | null;
  readonly status: string;
}

export interface AthleteSummary {
  readonly id: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly birthDate: string | null;
  readonly position: string | null;
  readonly status: AthleteStatus;
  readonly teams: readonly string[];
  readonly hasAccount: boolean;
}

/** Efeitos opcionais ao inativar ou suspender (docs/29 COR-018, PEN-060). */
export interface StatusEffects {
  /** Cancela mensalidades do mês atual em diante sem nenhum pagamento registrado. */
  readonly cancelFutureFees?: boolean;
  readonly endPlan?: boolean;
  /** Só ao inativar: encerra os vínculos abertos com equipes. */
  readonly endMemberships?: boolean;
}

/** O que está pendente para o diálogo de mudança de status. */
export interface StatusImpact {
  readonly cancellableFees: number;
  /** Mensalidades em aberto que não serão canceladas (meses passados ou com pagamento). */
  readonly keptOpenFees: number;
  readonly activePlan: { readonly name: string } | null;
  readonly openMemberships: { readonly team: string }[];
}

const CANCELLABLE_FEE_STATUS = ['OPEN', 'OVERDUE'] as const;

export interface AthleteDetail extends AthleteSummary {
  readonly email: string | null;
  readonly phone: string | null;
  readonly gender: Gender | null;
  readonly documentNumberMasked: string | null;
  /** Documento gravado antes do padrão CPF (PEN-056): precisa ser revisto pela diretoria. */
  readonly documentNeedsReview: boolean;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly guardianName: string | null;
  readonly guardianPhone: string | null;
  readonly guardianAcknowledgedAt: string | null;
  readonly notes: string | null;
  readonly user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    profilePublic: boolean;
  } | null;
  /** Perfil público no site (DT-044): menor ou sem nascimento precisa de autorização. */
  readonly publicProfile: {
    readonly needsGuardianConsent: boolean;
    readonly guardianConsentAt: string | null;
    readonly visibleOnSite: boolean;
  };
  readonly memberships: readonly MembershipView[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AthleteFilters extends PageQueryDto {
  readonly status?: AthleteStatus;
  readonly teamId?: string;
}

const DETAIL_INCLUDE = {
  user: {
    select: { id: true, name: true, email: true, avatarMediaFileId: true, profilePublic: true }
  },
  teamMemberships: {
    orderBy: { startsOn: 'desc' },
    include: { team: { select: { id: true, name: true, type: true } } }
  }
} satisfies Prisma.AthleteInclude;

type AthleteRow = Prisma.AthleteGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** Campos comparados para histórico de alterações (RF-009). Documento só registra "alterado". */
const TRACKED_FIELDS = [
  'fullName',
  'preferredName',
  'birthDate',
  'email',
  'phone',
  'gender',
  'position',
  'emergencyContactName',
  'emergencyContactPhone',
  'guardianName',
  'guardianPhone',
  'notes'
] as const;

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

@Injectable()
export class AthletesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService
  ) {}

  /** Exibe o CPF mascarado; documento legado (RG ou inválido) fica marcado para revisão. */
  private documentView(encrypted: string | null): {
    documentNumberMasked: string | null;
    documentNeedsReview: boolean;
  } {
    if (encrypted === null) {
      return { documentNumberMasked: null, documentNeedsReview: false };
    }

    const plain = decryptField(encrypted, this.config.values.dataEncryptionKey);

    return isValidCpf(plain)
      ? { documentNumberMasked: maskCpf(plain), documentNeedsReview: false }
      : {
          documentNumberMasked:
            plain.length <= 4 ? '****' : `${'*'.repeat(plain.length - 4)}${plain.slice(-4)}`,
          documentNeedsReview: true
        };
  }

  private activeTeams(row: AthleteRow): string[] {
    return row.teamMemberships
      .filter((membership) => membership.status === 'ACTIVE' && membership.endsOn === null)
      .map((membership) => membership.team.name);
  }

  private toDetail(row: AthleteRow): AthleteDetail {
    return {
      id: row.id,
      fullName: row.fullName,
      preferredName: row.preferredName,
      birthDate: optionalCivil(row.birthDate),
      position: row.position,
      status: row.status,
      teams: this.activeTeams(row),
      hasAccount: row.userId !== null,
      email: row.email,
      phone: row.phone,
      gender: row.gender,
      ...this.documentView(row.documentNumberEncrypted),
      emergencyContactName: row.emergencyContactName,
      emergencyContactPhone: row.emergencyContactPhone,
      guardianName: row.guardianName,
      guardianPhone: row.guardianPhone,
      guardianAcknowledgedAt: row.guardianAcknowledgedAt?.toISOString() ?? null,
      notes: row.notes,
      user: row.user
        ? {
            id: row.user.id,
            name: row.user.name,
            email: row.user.email,
            avatarUrl: row.user.avatarMediaFileId ? mediaUrl(row.user.avatarMediaFileId) : null,
            profilePublic: row.user.profilePublic
          }
        : null,
      publicProfile: this.publicProfileView(row),
      memberships: row.teamMemberships.map((membership) => ({
        id: membership.id,
        team: membership.team,
        startsOn: dateToCivil(membership.startsOn),
        endsOn: optionalCivil(membership.endsOn),
        position: membership.position,
        status: membership.status
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private today(): string {
    return todayIn();
  }

  /** Menor de 18 ou sem data de nascimento: perfil público só com autorização (LGPD art. 14). */
  private publicProfileView(row: {
    birthDate: Date | null;
    status: AthleteStatus;
    publicProfileConsentAt: Date | null;
    user: { profilePublic: boolean } | null;
  }): AthleteDetail['publicProfile'] {
    const needsGuardianConsent =
      row.birthDate === null || ageOn(dateToCivil(row.birthDate), this.today()) < ADULT_AGE;
    const consented = !needsGuardianConsent || row.publicProfileConsentAt !== null;

    return {
      needsGuardianConsent,
      guardianConsentAt: row.publicProfileConsentAt?.toISOString() ?? null,
      visibleOnSite: row.status === 'ACTIVE' && row.user?.profilePublic === true && consented
    };
  }

  /** Diretoria registra (ou retira) a autorização do responsável para o perfil público. */
  async setPublicProfileConsent(
    actor: Principal,
    id: string,
    granted: boolean,
    reason: string,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.athlete.findFirst({
        where: { id, deletedAt: null },
        select: { publicProfileConsentAt: true }
      });

      if (current === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      await tx.athlete.update({
        where: { id },
        data: { publicProfileConsentAt: granted ? new Date() : null }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: granted
            ? 'athlete.public_profile_consent.granted'
            : 'athlete.public_profile_consent.revoked',
          entityType: 'Athlete',
          entityId: id,
          reason,
          before: { consented: current.publicProfileConsentAt !== null },
          after: { consented: granted },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  async list(filters: AthleteFilters): Promise<Page<AthleteSummary>> {
    const { skip, take, page, pageSize } = pageArgs(filters);
    const search = filters.search?.trim();
    const where: Prisma.AthleteWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.teamId
        ? { teamMemberships: { some: { teamId: filters.teamId, status: 'ACTIVE', endsOn: null } } }
        : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { preferredName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.athlete.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: { fullName: 'asc' },
        skip,
        take
      }),
      this.prisma.athlete.count({ where })
    ]);

    return toPage(
      rows.map((row) => {
        const detail = this.toDetail(row);

        return {
          id: detail.id,
          fullName: detail.fullName,
          preferredName: detail.preferredName,
          birthDate: detail.birthDate,
          position: detail.position,
          status: detail.status,
          teams: detail.teams,
          hasAccount: detail.hasAccount
        };
      }),
      total,
      page,
      pageSize
    );
  }

  async get(id: string): Promise<AthleteDetail> {
    const row = await this.prisma.athlete.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Atleta não encontrado.');
    }

    return this.toDetail(row);
  }

  /** Área do atleta: somente o registro vinculado ao próprio usuário (RF-019). */
  async getOwn(userId: string): Promise<AthleteDetail | null> {
    const row = await this.prisma.athlete.findFirst({
      where: { userId, deletedAt: null },
      include: DETAIL_INCLUDE
    });

    return row === null ? null : this.toDetail(row);
  }

  private validate(input: AthleteInput, current?: AthleteRow): void {
    const birthDate =
      input.birthDate === undefined ? optionalCivil(current?.birthDate ?? null) : input.birthDate;
    const errors = validateGuardian(
      {
        birthDate,
        guardianName:
          input.guardianName === undefined ? (current?.guardianName ?? null) : input.guardianName,
        guardianPhone:
          input.guardianPhone === undefined
            ? (current?.guardianPhone ?? null)
            : input.guardianPhone,
        guardianAcknowledged:
          input.guardianAcknowledged ??
          (current !== undefined && current.guardianAcknowledgedAt !== null)
      },
      this.today(),
      'admin'
    );

    if (errors.length > 0) {
      throw AppError.validation('ATHLETE_INVALID', 'Revise os dados do atleta.', errors);
    }
  }

  private async assertNotDuplicate(
    tx: PrismaTx,
    fullName: string,
    birthDate: string | null,
    documentHash: string | null,
    ignoreId?: string
  ): Promise<void> {
    if (documentHash) {
      const byDocument = await tx.athlete.findFirst({
        where: { documentNumberHash: documentHash, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
        select: { id: true }
      });

      if (byDocument) {
        throw AppError.conflict('DUPLICATE_DOCUMENT', 'Já existe atleta com este documento.');
      }
    }

    if (birthDate) {
      const sameBirth = await tx.athlete.findMany({
        where: {
          birthDate: civilToDate(birthDate),
          deletedAt: null,
          ...(ignoreId ? { id: { not: ignoreId } } : {})
        },
        select: { fullName: true }
      });

      if (sameBirth.some((row) => normalizeName(row.fullName) === normalizeName(fullName))) {
        throw AppError.conflict(
          'DUPLICATE_ATHLETE',
          'Já existe atleta com o mesmo nome e data de nascimento.'
        );
      }
    }
  }

  private documentFields(document: string | null | undefined): {
    documentNumberEncrypted?: string | null;
    documentNumberHash?: string | null;
  } {
    if (document === undefined) {
      return {};
    }

    const normalized = document ? normalizeDocument(document) : '';

    return normalized
      ? {
          documentNumberEncrypted: encryptField(normalized, this.config.values.dataEncryptionKey),
          documentNumberHash: sha256Hex(`athlete-doc:${normalized}`)
        }
      : { documentNumberEncrypted: null, documentNumberHash: null };
  }

  /**
   * Cria atleta dentro de uma transação existente. Usado também pela conversão de
   * interessado/inscrição, preservando a origem (RN-ATL-004).
   */
  async createInTx(
    tx: PrismaTx,
    actor: Principal,
    input: AthleteInput,
    meta: RequestMeta,
    origin: { type: string; id: string } | null
  ): Promise<string> {
    this.validate(input);
    const document = this.documentFields(input.documentNumber);
    const birthDate = input.birthDate ?? null;

    await this.assertNotDuplicate(
      tx,
      input.fullName,
      birthDate,
      document.documentNumberHash ?? null
    );

    const created = await tx.athlete.create({
      data: {
        fullName: input.fullName.trim(),
        preferredName: trimOrNull(input.preferredName),
        birthDate: birthDate ? civilToDate(birthDate) : null,
        ...document,
        email: input.email ? normalizeEmail(input.email) : null,
        phone: trimOrNull(input.phone),
        gender: input.gender ?? null,
        position: trimOrNull(input.position),
        emergencyContactName: trimOrNull(input.emergencyContactName),
        emergencyContactPhone: trimOrNull(input.emergencyContactPhone),
        guardianName: trimOrNull(input.guardianName),
        guardianPhone: trimOrNull(input.guardianPhone),
        guardianAcknowledgedAt: input.guardianAcknowledged ? new Date() : null,
        notes: trimOrNull(input.notes),
        status: 'PENDING'
      },
      select: { id: true }
    });

    await this.audit.record(
      {
        actorUserId: actor.userId,
        action: 'athlete.created',
        entityType: 'Athlete',
        entityId: created.id,
        after: { fullName: input.fullName, status: 'PENDING', origin },
        meta
      },
      tx
    );

    return created.id;
  }

  async create(actor: Principal, input: AthleteInput, meta: RequestMeta): Promise<AthleteDetail> {
    const id = await this.prisma.$transaction((tx) =>
      this.createInTx(tx, actor, input, meta, null)
    );

    return this.get(id);
  }

  async update(
    actor: Principal,
    id: string,
    input: AthleteInput | Partial<AthleteInput>,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.athlete.findFirst({
        where: { id, deletedAt: null },
        include: DETAIL_INCLUDE
      });

      if (current === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      this.validate(input as AthleteInput, current);
      const document = this.documentFields(input.documentNumber);
      const fullName = input.fullName ?? current.fullName;
      const birthDate =
        input.birthDate === undefined ? optionalCivil(current.birthDate) : input.birthDate;

      if (
        input.fullName !== undefined ||
        input.birthDate !== undefined ||
        document.documentNumberHash
      ) {
        await this.assertNotDuplicate(
          tx,
          fullName,
          birthDate,
          document.documentNumberHash ?? null,
          id
        );
      }

      const data: Prisma.AthleteUpdateInput = {
        ...(input.fullName === undefined ? {} : { fullName: input.fullName.trim() }),
        ...(input.preferredName === undefined
          ? {}
          : { preferredName: trimOrNull(input.preferredName) }),
        ...(input.birthDate === undefined
          ? {}
          : { birthDate: input.birthDate ? civilToDate(input.birthDate) : null }),
        ...document,
        ...(input.email === undefined
          ? {}
          : { email: input.email ? normalizeEmail(input.email) : null }),
        ...(input.phone === undefined ? {} : { phone: trimOrNull(input.phone) }),
        ...(input.gender === undefined ? {} : { gender: input.gender }),
        ...(input.position === undefined ? {} : { position: trimOrNull(input.position) }),
        ...(input.emergencyContactName === undefined
          ? {}
          : { emergencyContactName: trimOrNull(input.emergencyContactName) }),
        ...(input.emergencyContactPhone === undefined
          ? {}
          : { emergencyContactPhone: trimOrNull(input.emergencyContactPhone) }),
        ...(input.guardianName === undefined
          ? {}
          : { guardianName: trimOrNull(input.guardianName) }),
        ...(input.guardianPhone === undefined
          ? {}
          : { guardianPhone: trimOrNull(input.guardianPhone) }),
        ...(input.guardianAcknowledged && current.guardianAcknowledgedAt === null
          ? { guardianAcknowledgedAt: new Date() }
          : {}),
        ...(input.notes === undefined ? {} : { notes: trimOrNull(input.notes) })
      };

      await tx.athlete.update({ where: { id }, data });

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const currentView = this.toDetail(current) as unknown as Record<string, unknown>;

      for (const field of TRACKED_FIELDS) {
        const next = (input as Record<string, unknown>)[field];

        if (next !== undefined && next !== currentView[field]) {
          before[field] = currentView[field] ?? null;
          after[field] = next;
        }
      }

      if (document.documentNumberHash !== undefined) {
        after['documentNumber'] = 'alterado';
      }

      if (Object.keys(after).length > 0) {
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'athlete.updated',
            entityType: 'Athlete',
            entityId: id,
            before,
            after,
            meta
          },
          tx
        );
      }
    });

    return this.get(id);
  }

  /** Pendências do atleta exibidas antes de inativar ou suspender (COR-018). */
  async statusImpact(id: string): Promise<StatusImpact> {
    const exists = await this.prisma.athlete.count({ where: { id, deletedAt: null } });

    if (exists === 0) {
      throw AppError.notFound('Atleta não encontrado.');
    }

    const fromMonth = civilToDate(monthStart(todayIn()));
    const [cancellableFees, openFees, plan, memberships] = await Promise.all([
      this.prisma.monthlyFee.count({
        where: {
          athleteId: id,
          status: { in: [...CANCELLABLE_FEE_STATUS] },
          referenceMonth: { gte: fromMonth },
          paymentAllocations: { none: {} }
        }
      }),
      this.prisma.monthlyFee.count({
        where: { athleteId: id, status: { in: ['OPEN', 'OVERDUE', 'PARTIALLY_PAID'] } }
      }),
      this.prisma.athleteMonthlyFeePlan.findFirst({
        where: { athleteId: id, status: 'ACTIVE', endsOn: null },
        select: { monthlyFeePlan: { select: { name: true } } }
      }),
      this.prisma.teamAthlete.findMany({
        where: { athleteId: id, status: 'ACTIVE', endsOn: null },
        select: { team: { select: { name: true } } }
      })
    ]);

    return {
      cancellableFees,
      keptOpenFees: openFees - cancellableFees,
      activePlan: plan ? { name: plan.monthlyFeePlan.name } : null,
      openMemberships: memberships.map((m) => ({ team: m.team.name }))
    };
  }

  /**
   * Aplica os efeitos escolhidos no mesmo instante e com o mesmo motivo da mudança de
   * status. Nunca cancela mensalidade com pagamento nem de mês passado (dívida real).
   */
  private async applyStatusEffects(
    tx: PrismaTx,
    actor: Principal,
    id: string,
    effects: StatusEffects,
    reason: string,
    meta: RequestMeta
  ): Promise<Record<string, number>> {
    const today = todayIn();
    const result: Record<string, number> = {};

    if (effects.cancelFutureFees) {
      const fees = await tx.monthlyFee.findMany({
        where: {
          athleteId: id,
          status: { in: [...CANCELLABLE_FEE_STATUS] },
          referenceMonth: { gte: civilToDate(monthStart(today)) },
          paymentAllocations: { none: {} }
        },
        select: { id: true, status: true }
      });

      for (const fee of fees) {
        await tx.monthlyFee.update({
          where: { id: fee.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledById: actor.userId,
            cancellationReason: reason
          }
        });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'fee.cancelled',
            entityType: 'MonthlyFee',
            entityId: fee.id,
            reason,
            before: { status: fee.status },
            after: { status: 'CANCELLED', origin: 'athlete.status.changed' },
            meta
          },
          tx
        );
      }

      result['cancelledFees'] = fees.length;
    }

    if (effects.endPlan) {
      const plans = await tx.athleteMonthlyFeePlan.findMany({
        where: { athleteId: id, status: 'ACTIVE', endsOn: null },
        select: { id: true, startsOn: true }
      });

      for (const plan of plans) {
        const startsOn = dateToCivil(plan.startsOn);
        const endsOn = startsOn > today ? startsOn : today;

        await tx.athleteMonthlyFeePlan.update({
          where: { id: plan.id },
          data: { endsOn: civilToDate(endsOn), status: 'ENDED' }
        });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'fee_plan.assignment.ended',
            entityType: 'Athlete',
            entityId: id,
            reason,
            after: { athletePlanId: plan.id, endsOn, origin: 'athlete.status.changed' },
            meta
          },
          tx
        );
      }

      result['endedPlans'] = plans.length;
    }

    if (effects.endMemberships) {
      const memberships = await tx.teamAthlete.findMany({
        where: { athleteId: id, status: 'ACTIVE', endsOn: null },
        select: { id: true, startsOn: true, team: { select: { name: true } } }
      });

      for (const membership of memberships) {
        const startsOn = dateToCivil(membership.startsOn);
        const endsOn = startsOn > today ? startsOn : today;

        await tx.teamAthlete.update({
          where: { id: membership.id },
          data: { endsOn: civilToDate(endsOn), status: 'INACTIVE' }
        });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'athlete.membership.ended',
            entityType: 'Athlete',
            entityId: id,
            reason,
            after: {
              membershipId: membership.id,
              team: membership.team.name,
              endsOn,
              origin: 'athlete.status.changed'
            },
            meta
          },
          tx
        );
      }

      result['endedMemberships'] = memberships.length;
    }

    return result;
  }

  async changeStatus(
    actor: Principal,
    id: string,
    status: AthleteStatus,
    reason: string,
    meta: RequestMeta,
    effects: StatusEffects = {}
  ): Promise<AthleteDetail> {
    const leaving = status === 'INACTIVE' || status === 'SUSPENDED';

    if (!leaving && (effects.cancelFutureFees || effects.endPlan || effects.endMemberships)) {
      throw AppError.validation(
        'EFFECTS_NOT_ALLOWED',
        'Cancelar mensalidades, encerrar plano ou vínculos só vale ao inativar ou suspender.'
      );
    }

    if (status === 'SUSPENDED' && effects.endMemberships) {
      throw AppError.validation(
        'EFFECTS_NOT_ALLOWED',
        'Na suspensão o atleta continua na equipe; encerre os vínculos só ao inativar.'
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.athlete.findFirst({
        where: { id, deletedAt: null },
        select: { status: true, userId: true }
      });

      if (current === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      assertTransition(ATHLETE_TRANSITIONS, current.status, status, ATHLETE_STATUS_LABELS);
      await tx.athlete.update({ where: { id }, data: { status } });

      const applied = await this.applyStatusEffects(tx, actor, id, effects, reason, meta);

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'athlete.status.changed',
          entityType: 'Athlete',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status, ...applied },
          meta
        },
        tx
      );

      if (current.userId) {
        await this.notifications.notify(
          {
            userId: current.userId,
            type: 'athlete.status',
            title: 'Situação de atleta atualizada',
            message: `Sua situação no time agora é: ${ATHLETE_STATUS_LABELS[status]}.`,
            link: '/minha-conta/atleta',
            deduplicationKey: `athlete-status:${id}:${status}:${Date.now()}`
          },
          tx
        );
      }
    });

    return this.get(id);
  }

  /** Vincula a conta de um usuário ao atleta e concede o papel `athlete` (auditado). */
  async linkUser(
    actor: Principal,
    id: string,
    email: string,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    await this.prisma.$transaction(async (tx) => {
      const athlete = await tx.athlete.findFirst({
        where: { id, deletedAt: null },
        select: { userId: true }
      });
      const user = await tx.user.findFirst({
        where: { email: normalizeEmail(email), deletedAt: null },
        select: { id: true, athlete: { select: { id: true } } }
      });

      if (athlete === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      if (user === null) {
        throw AppError.validation(
          'USER_NOT_FOUND',
          'Nenhuma conta encontrada com este e-mail. Peça para a pessoa se cadastrar primeiro.'
        );
      }

      if (user.athlete && user.athlete.id !== id) {
        throw AppError.conflict(
          'USER_ALREADY_LINKED',
          'Esta conta já está vinculada a outro atleta.'
        );
      }

      const role = await tx.role.findUniqueOrThrow({
        where: { code: SYSTEM_ROLES.athlete },
        select: { id: true }
      });

      await tx.athlete.update({ where: { id }, data: { userId: user.id } });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id, grantedById: actor.userId },
        update: {}
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'athlete.user.linked',
          entityType: 'Athlete',
          entityId: id,
          before: { userId: athlete.userId },
          after: { userId: user.id },
          meta
        },
        tx
      );
      await this.notifications.notify(
        {
          userId: user.id,
          type: 'athlete.linked',
          title: 'Área do atleta liberada',
          message: 'Sua conta foi vinculada ao cadastro de atleta do Fênix.',
          link: '/minha-conta/atleta',
          deduplicationKey: `athlete-linked:${id}:${user.id}`
        },
        tx
      );
    });

    return this.get(id);
  }

  async unlinkUser(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    await this.prisma.$transaction(async (tx) => {
      const athlete = await tx.athlete.findFirst({
        where: { id, deletedAt: null },
        select: { userId: true }
      });

      if (athlete === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      if (athlete.userId === null) {
        return;
      }

      const role = await tx.role.findUniqueOrThrow({
        where: { code: SYSTEM_ROLES.athlete },
        select: { id: true }
      });

      await tx.athlete.update({ where: { id }, data: { userId: null } });
      await tx.userRole.deleteMany({ where: { userId: athlete.userId, roleId: role.id } });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'athlete.user.unlinked',
          entityType: 'Athlete',
          entityId: id,
          reason,
          before: { userId: athlete.userId },
          after: { userId: null },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  /** RF-010: novo vínculo com período; não pode sobrepor vínculo ativo na mesma equipe. */
  async addMembership(
    actor: Principal,
    id: string,
    input: { teamId: string; startsOn: string; position?: string | null },
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    await this.prisma.$transaction(async (tx) => {
      const athlete = await tx.athlete.findFirst({
        where: { id, deletedAt: null },
        select: { id: true }
      });
      const team = await tx.team.findFirst({
        where: { id: input.teamId, deletedAt: null },
        select: { id: true, name: true, isActive: true }
      });

      if (athlete === null) {
        throw AppError.notFound('Atleta não encontrado.');
      }

      if (team === null || !team.isActive) {
        throw AppError.validation('INVALID_TEAM', 'Equipe inexistente ou inativa.');
      }

      const existing = await tx.teamAthlete.findMany({
        where: { athleteId: id, teamId: input.teamId, status: 'ACTIVE' },
        select: { startsOn: true, endsOn: true }
      });
      const overlaps = existing.some((period) =>
        periodsOverlap(
          { startsOn: dateToCivil(period.startsOn), endsOn: optionalCivil(period.endsOn) },
          { startsOn: input.startsOn, endsOn: null }
        )
      );

      if (overlaps) {
        throw AppError.conflict(
          'MEMBERSHIP_OVERLAP',
          'O atleta já possui vínculo vigente nesta equipe no período.'
        );
      }

      const membership = await tx.teamAthlete.create({
        data: {
          athleteId: id,
          teamId: input.teamId,
          startsOn: civilToDate(input.startsOn),
          position: trimOrNull(input.position)
        },
        select: { id: true }
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'athlete.membership.added',
          entityType: 'Athlete',
          entityId: id,
          after: { membershipId: membership.id, team: team.name, startsOn: input.startsOn },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }

  /** Encerra o vínculo preservando o histórico (RN-ATL-006). */
  async endMembership(
    actor: Principal,
    id: string,
    membershipId: string,
    endsOn: string,
    reason: string,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.teamAthlete.findFirst({
        where: { id: membershipId, athleteId: id },
        include: { team: { select: { name: true } } }
      });

      if (membership === null) {
        throw AppError.notFound('Vínculo não encontrado.');
      }

      if (membership.endsOn !== null || membership.status !== 'ACTIVE') {
        throw AppError.conflict('MEMBERSHIP_CLOSED', 'Este vínculo já foi encerrado.');
      }

      if (endsOn < dateToCivil(membership.startsOn)) {
        throw AppError.validation(
          'INVALID_END_DATE',
          'A data de término não pode ser anterior ao início.'
        );
      }

      await tx.teamAthlete.update({
        where: { id: membershipId },
        data: { endsOn: civilToDate(endsOn), status: 'INACTIVE' }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'athlete.membership.ended',
          entityType: 'Athlete',
          entityId: id,
          reason,
          after: { membershipId, team: membership.team.name, endsOn },
          meta
        },
        tx
      );
    });

    return this.get(id);
  }
}
