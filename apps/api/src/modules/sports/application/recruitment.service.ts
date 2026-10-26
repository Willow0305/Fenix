import { Injectable } from '@nestjs/common';
import type {
  Gender,
  InterestedPersonStatus,
  Prisma,
  TryoutRegistrationStatus,
  TryoutStatus
} from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import { assertTransition } from '../../../common/domain/state-machine';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { normalizeEmail } from '../../auth/domain/auth-rules';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  INTERESTED_LABELS,
  INTERESTED_TRANSITIONS,
  PRIVACY_NOTICE_VERSION,
  REASON_REQUIRED_REGISTRATION,
  REGISTRATION_BLOCK_MESSAGES,
  registrationBlock,
  SLOT_CONSUMING,
  slugify,
  TRYOUT_REGISTRATION_LABELS,
  TRYOUT_REGISTRATION_TRANSITIONS,
  TRYOUT_STATUS_LABELS,
  TRYOUT_TRANSITIONS,
  validateGuardian
} from '../domain/sports-rules';
import { type AthleteDetail, type AthleteInput, AthletesService } from './athletes.service';
import { assertActiveTeam } from './active-team';
import { StaffAlertsService } from '../../notifications/application/staff-alerts.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';

export interface ApplicantInput {
  readonly fullName: string;
  readonly birthDate: string;
  readonly email: string;
  readonly phone: string;
  readonly gender?: Gender | null;
  readonly desiredPosition?: string | null;
  readonly experience?: string | null;
  readonly guardianName?: string | null;
  readonly guardianPhone?: string | null;
}

export interface InterestedView {
  readonly id: string;
  readonly fullName: string;
  readonly birthDate: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly desiredPosition: string | null;
  readonly notes: string | null;
  readonly guardianName: string | null;
  readonly guardianPhone: string | null;
  readonly status: InterestedPersonStatus;
  readonly convertedAthleteId: string | null;
  readonly createdAt: string;
}

export interface TryoutInput {
  readonly title: string;
  readonly description?: string | null;
  readonly location?: string | null;
  readonly teamId?: string | null;
  readonly startsAt?: string | null;
  readonly registrationStartsAt?: string | null;
  readonly registrationEndsAt?: string | null;
  readonly maxSlots?: number | null;
}

export interface TryoutView {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly team: { id: string; name: string; type: string } | null;
  readonly startsAt: string | null;
  readonly registrationStartsAt: string | null;
  readonly registrationEndsAt: string | null;
  readonly maxSlots: number | null;
  readonly usedSlots: number;
  readonly status: TryoutStatus;
  readonly acceptingRegistrations: boolean;
  readonly blockReason: string | null;
  readonly cancellationReason: string | null;
}

export interface TryoutRegistrationView {
  readonly id: string;
  readonly tryout: { id: string; title: string; slug: string };
  readonly fullName: string;
  readonly birthDate: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly gender: Gender | null;
  readonly desiredPosition: string | null;
  readonly experience: string | null;
  readonly guardianName: string | null;
  readonly guardianPhone: string | null;
  readonly status: TryoutRegistrationStatus;
  readonly reviewReason: string | null;
  readonly reviewedAt: string | null;
  readonly athleteId: string | null;
  readonly createdAt: string;
}

const PUBLIC_TRYOUT_STATUSES: readonly TryoutStatus[] = [
  'SCHEDULED',
  'OPEN',
  'CLOSED',
  'COMPLETED'
];

const TRYOUT_INCLUDE = {
  team: { select: { id: true, name: true, type: true } },
  _count: {
    select: { registrations: { where: { status: { in: [...SLOT_CONSUMING] }, deletedAt: null } } }
  }
} satisfies Prisma.TryoutInclude;

type TryoutRow = Prisma.TryoutGetPayload<{ include: typeof TRYOUT_INCLUDE }>;

const REGISTRATION_INCLUDE = {
  tryout: { select: { id: true, title: true, slug: true } }
} satisfies Prisma.TryoutRegistrationInclude;

type RegistrationRow = Prisma.TryoutRegistrationGetPayload<{
  include: typeof REGISTRATION_INCLUDE;
}>;

function toRegistrationView(row: RegistrationRow): TryoutRegistrationView {
  return {
    id: row.id,
    tryout: row.tryout,
    fullName: row.fullName,
    birthDate: optionalCivil(row.birthDate),
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    desiredPosition: row.desiredPosition,
    experience: row.experience,
    guardianName: row.guardianName,
    guardianPhone: row.guardianPhone,
    status: row.status,
    reviewReason: row.reviewReason,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    athleteId: row.athleteId,
    createdAt: row.createdAt.toISOString()
  };
}

function toInterestedView(row: Prisma.InterestedPersonGetPayload<object>): InterestedView {
  return {
    id: row.id,
    fullName: row.fullName,
    birthDate: optionalCivil(row.birthDate),
    email: row.email,
    phone: row.phone,
    desiredPosition: row.desiredPosition,
    notes: row.notes,
    guardianName: row.guardianName,
    guardianPhone: row.guardianPhone,
    status: row.status,
    convertedAthleteId: row.convertedAthleteId,
    createdAt: row.createdAt.toISOString()
  };
}

function iso(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** Interessados, seletivas e inscrições (RF-003, RF-004, RN-ATL-001..004). */
@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly athletes: AthletesService,
    private readonly notifications: NotificationsService,
    private readonly staffAlerts: StaffAlertsService
  ) {}

  private assertApplicant(input: ApplicantInput): void {
    const errors = validateGuardian(
      {
        birthDate: input.birthDate,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null
      },
      todayIn(),
      'public'
    );

    if (errors.length > 0) {
      throw AppError.validation('APPLICANT_INVALID', 'Revise os dados informados.', errors);
    }
  }

  // ---------- Interessados ----------

  /** Cadastro público: não cria conta nem atleta (PEN-008/RN-ATL-001). */
  async registerInterest(
    input: ApplicantInput & { notes?: string | null },
    principal: Principal | undefined,
    meta: RequestMeta
  ): Promise<{ id: string }> {
    this.assertApplicant(input);
    const created = await this.prisma.interestedPerson.create({
      data: {
        fullName: input.fullName.trim(),
        birthDate: civilToDate(input.birthDate),
        email: normalizeEmail(input.email),
        phone: input.phone.trim(),
        desiredPosition: input.desiredPosition?.trim() || null,
        notes: input.notes?.trim() || null,
        guardianName: input.guardianName?.trim() || null,
        guardianPhone: input.guardianPhone?.trim() || null,
        source: 'site',
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        consentAt: new Date()
      },
      select: { id: true }
    });

    await this.audit.record({
      actorUserId: principal?.userId ?? null,
      action: 'interested.created',
      entityType: 'InterestedPerson',
      entityId: created.id,
      meta
    });
    await this.staffAlerts.alert(PERMISSIONS.registrationsRead, {
      type: 'staff.interest.created',
      title: 'Novo interessado',
      message: `${input.fullName.trim()} quer jogar no Fênix.`,
      link: '/admin/interessados',
      key: `staff-interest:${created.id}`
    });

    return created;
  }

  async listInterested(
    query: PageQueryDto & { status?: InterestedPersonStatus }
  ): Promise<Page<InterestedView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const search = query.search?.trim();
    // Telefones são gravados só com dígitos (DT-040): "(68) 9999" também encontra.
    const digits = search ? search.replace(/\D+/g, '') : '';
    const where: Prisma.InterestedPersonWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.interestedPerson.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.interestedPerson.count({ where })
    ]);

    return toPage(rows.map(toInterestedView), total, page, pageSize);
  }

  async changeInterestedStatus(
    actor: Principal,
    id: string,
    status: InterestedPersonStatus,
    reason: string | null,
    meta: RequestMeta
  ): Promise<InterestedView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.interestedPerson.findFirst({ where: { id, deletedAt: null } });

      if (current === null) {
        throw AppError.notFound('Interessado não encontrado.');
      }

      assertTransition(INTERESTED_TRANSITIONS, current.status, status, INTERESTED_LABELS);
      const row = await tx.interestedPerson.update({ where: { id }, data: { status } });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'interested.status.changed',
          entityType: 'InterestedPerson',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );

      return row;
    });

    return toInterestedView(updated);
  }

  /** Conversão explícita e auditada; a diretoria revisa os dados completos (PEN-016). */
  async convertInterested(
    actor: Principal,
    id: string,
    athlete: AthleteInput,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    const athleteId = await this.prisma.$transaction(async (tx) => {
      const current = await tx.interestedPerson.findFirst({ where: { id, deletedAt: null } });

      if (current === null) {
        throw AppError.notFound('Interessado não encontrado.');
      }

      if (current.status === 'CONVERTED' || current.convertedAthleteId) {
        throw AppError.conflict(
          'ALREADY_CONVERTED',
          'Este interessado já foi convertido em atleta.'
        );
      }

      const createdId = await this.athletes.createInTx(tx, actor, athlete, meta, {
        type: 'InterestedPerson',
        id
      });

      await tx.interestedPerson.update({
        where: { id },
        data: { status: 'CONVERTED', convertedAthleteId: createdId }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'interested.converted',
          entityType: 'InterestedPerson',
          entityId: id,
          before: { status: current.status },
          after: { status: 'CONVERTED', athleteId: createdId },
          meta
        },
        tx
      );

      return createdId;
    });

    return this.athletes.get(athleteId);
  }

  // ---------- Seletivas ----------

  private toTryoutView(row: TryoutRow, now: Date): TryoutView {
    const usedSlots = row._count.registrations;
    const block = registrationBlock(row, usedSlots, now);

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      location: row.location,
      team: row.team,
      startsAt: row.startsAt?.toISOString() ?? null,
      registrationStartsAt: row.registrationStartsAt?.toISOString() ?? null,
      registrationEndsAt: row.registrationEndsAt?.toISOString() ?? null,
      maxSlots: row.maxSlots,
      usedSlots,
      status: row.status,
      acceptingRegistrations: block === null,
      blockReason: block === null ? null : REGISTRATION_BLOCK_MESSAGES[block],
      cancellationReason: row.cancellationReason
    };
  }

  async listTryouts(publicOnly: boolean): Promise<TryoutView[]> {
    const rows = await this.prisma.tryout.findMany({
      where: {
        deletedAt: null,
        ...(publicOnly ? { status: { in: [...PUBLIC_TRYOUT_STATUSES] } } : {})
      },
      include: TRYOUT_INCLUDE,
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }]
    });
    const now = new Date();

    return rows.map((row) => this.toTryoutView(row, now));
  }

  async getTryout(idOrSlug: string, publicOnly: boolean): Promise<TryoutView> {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const row = await this.prisma.tryout.findFirst({
      where: {
        deletedAt: null,
        ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }),
        ...(publicOnly ? { status: { in: [...PUBLIC_TRYOUT_STATUSES] } } : {})
      },
      include: TRYOUT_INCLUDE
    });

    if (row === null) {
      throw AppError.notFound('Seletiva não encontrada.');
    }

    return this.toTryoutView(row, new Date());
  }

  private assertTryoutDates(input: Partial<TryoutInput>): void {
    const start = iso(input.registrationStartsAt);
    const end = iso(input.registrationEndsAt);

    if (start && end && start >= end) {
      throw AppError.validation(
        'INVALID_PERIOD',
        'O início das inscrições deve ser anterior ao término.'
      );
    }
  }

  async createTryout(actor: Principal, input: TryoutInput, meta: RequestMeta): Promise<TryoutView> {
    this.assertTryoutDates(input);
    const base = slugify(input.title) || 'seletiva';
    let slug = base;

    for (
      let n = 2;
      await this.prisma.tryout.findUnique({ where: { slug }, select: { id: true } });
      n += 1
    ) {
      slug = `${base}-${n}`;
    }

    await assertActiveTeam(this.prisma, input.teamId);

    const created = await this.prisma.tryout.create({
      data: {
        title: input.title.trim(),
        slug,
        description: input.description ?? null,
        location: input.location ?? null,
        teamId: input.teamId ?? null,
        startsAt: iso(input.startsAt),
        registrationStartsAt: iso(input.registrationStartsAt),
        registrationEndsAt: iso(input.registrationEndsAt),
        maxSlots: input.maxSlots ?? null
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'tryout.created',
      entityType: 'Tryout',
      entityId: created.id,
      after: { title: created.title },
      meta
    });

    return this.getTryout(created.id, false);
  }

  async updateTryout(
    actor: Principal,
    id: string,
    input: Partial<TryoutInput>,
    meta: RequestMeta
  ): Promise<TryoutView> {
    const current = await this.prisma.tryout.findFirst({ where: { id, deletedAt: null } });

    if (current === null) {
      throw AppError.notFound('Seletiva não encontrada.');
    }

    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw AppError.conflict(
        'TRYOUT_LOCKED',
        'Seletivas concluídas ou canceladas não podem ser editadas.'
      );
    }

    this.assertTryoutDates({
      registrationStartsAt:
        input.registrationStartsAt === undefined
          ? (current.registrationStartsAt?.toISOString() ?? null)
          : input.registrationStartsAt,
      registrationEndsAt:
        input.registrationEndsAt === undefined
          ? (current.registrationEndsAt?.toISOString() ?? null)
          : input.registrationEndsAt
    });
    await assertActiveTeam(this.prisma, input.teamId, current.teamId);
    await this.prisma.tryout.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title.trim() }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.location === undefined ? {} : { location: input.location }),
        ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
        ...(input.startsAt === undefined ? {} : { startsAt: iso(input.startsAt) }),
        ...(input.registrationStartsAt === undefined
          ? {}
          : { registrationStartsAt: iso(input.registrationStartsAt) }),
        ...(input.registrationEndsAt === undefined
          ? {}
          : { registrationEndsAt: iso(input.registrationEndsAt) }),
        ...(input.maxSlots === undefined ? {} : { maxSlots: input.maxSlots })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'tryout.updated',
      entityType: 'Tryout',
      entityId: id,
      after: input as Record<string, unknown>,
      meta
    });

    return this.getTryout(id, false);
  }

  async changeTryoutStatus(
    actor: Principal,
    id: string,
    status: TryoutStatus,
    reason: string | null,
    meta: RequestMeta
  ): Promise<TryoutView> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.tryout.findFirst({ where: { id, deletedAt: null } });

      if (current === null) {
        throw AppError.notFound('Seletiva não encontrada.');
      }

      assertTransition(TRYOUT_TRANSITIONS, current.status, status, TRYOUT_STATUS_LABELS);

      if (status === 'CANCELLED' && !reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo do cancelamento.');
      }

      await tx.tryout.update({
        where: { id },
        data: { status, ...(status === 'CANCELLED' ? { cancellationReason: reason } : {}) }
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'tryout.status.changed',
          entityType: 'Tryout',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );

      if (status === 'CANCELLED') {
        const applicants = await tx.tryoutRegistration.findMany({
          where: {
            tryoutId: id,
            applicantUserId: { not: null },
            deletedAt: null,
            status: { in: [...SLOT_CONSUMING] }
          },
          select: { id: true, applicantUserId: true }
        });

        await this.notifications.notify(
          applicants.map((applicant) => ({
            userId: applicant.applicantUserId as string,
            type: 'tryout.cancelled',
            title: 'Seletiva cancelada',
            message: `A seletiva "${current.title}" foi cancelada.`,
            link: '/minha-conta/inscricoes',
            deduplicationKey: `tryout-cancelled:${applicant.id}`
          })),
          tx
        );
      }
    });

    return this.getTryout(id, false);
  }

  // ---------- Inscrições ----------

  async registerToTryout(
    slug: string,
    input: ApplicantInput,
    principal: Principal | undefined,
    meta: RequestMeta
  ): Promise<TryoutRegistrationView> {
    this.assertApplicant(input);
    const email = normalizeEmail(input.email);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const tryout = await tx.tryout.findFirst({ where: { slug, deletedAt: null } });

        if (tryout === null) {
          throw AppError.notFound('Seletiva não encontrada.');
        }

        const used = await tx.tryoutRegistration.count({
          where: { tryoutId: tryout.id, deletedAt: null, status: { in: [...SLOT_CONSUMING] } }
        });
        const block = registrationBlock(tryout, used, new Date());

        if (block !== null) {
          throw AppError.conflict(`TRYOUT_${block}`, REGISTRATION_BLOCK_MESSAGES[block]);
        }

        const duplicate = await tx.tryoutRegistration.findFirst({
          where: {
            tryoutId: tryout.id,
            email,
            deletedAt: null,
            status: { notIn: ['CANCELLED', 'REJECTED'] }
          },
          select: { id: true }
        });

        if (duplicate) {
          throw AppError.conflict(
            'DUPLICATE_REGISTRATION',
            'Já existe uma inscrição com este e-mail nesta seletiva.'
          );
        }

        const ownAthlete = principal
          ? await tx.athlete.findFirst({
              where: { userId: principal.userId, deletedAt: null },
              select: { id: true }
            })
          : null;

        return tx.tryoutRegistration.create({
          data: {
            tryoutId: tryout.id,
            applicantUserId: principal?.userId ?? null,
            athleteId: ownAthlete?.id ?? null,
            fullName: input.fullName.trim(),
            birthDate: civilToDate(input.birthDate),
            email,
            phone: input.phone.trim(),
            gender: input.gender ?? null,
            desiredPosition: input.desiredPosition?.trim() || null,
            experience: input.experience?.trim() || null,
            guardianName: input.guardianName?.trim() || null,
            guardianPhone: input.guardianPhone?.trim() || null,
            privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
            consentAt: new Date()
          },
          include: REGISTRATION_INCLUDE
        });
      },
      { isolationLevel: 'Serializable' }
    );

    await this.audit.record({
      actorUserId: principal?.userId ?? null,
      action: 'tryout_registration.created',
      entityType: 'TryoutRegistration',
      entityId: created.id,
      meta
    });

    const view = toRegistrationView(created);

    await this.staffAlerts.alert(PERMISSIONS.registrationsRead, {
      type: 'staff.tryout.registration',
      title: `Nova inscrição: ${view.tryout.title}`,
      message: `${view.fullName} se inscreveu na seletiva.`,
      link: `/admin/seletivas/${view.tryout.id}`,
      key: `staff-tryout-registration:${created.id}`
    });

    return view;
  }

  async listRegistrations(
    tryoutId: string,
    query: PageQueryDto & { status?: TryoutRegistrationStatus }
  ): Promise<Page<TryoutRegistrationView>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const search = query.search?.trim();
    const where: Prisma.TryoutRegistrationWhereInput = {
      tryoutId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { fullName: { contains: search, mode: 'insensitive' } } : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tryoutRegistration.findMany({
        where,
        include: REGISTRATION_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip,
        take
      }),
      this.prisma.tryoutRegistration.count({ where })
    ]);

    return toPage(rows.map(toRegistrationView), total, page, pageSize);
  }

  async myRegistrations(userId: string): Promise<TryoutRegistrationView[]> {
    const rows = await this.prisma.tryoutRegistration.findMany({
      where: { applicantUserId: userId, deletedAt: null },
      include: REGISTRATION_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    return rows.map(toRegistrationView);
  }

  async reviewRegistration(
    actor: Principal,
    id: string,
    status: TryoutRegistrationStatus,
    reason: string | null,
    meta: RequestMeta
  ): Promise<TryoutRegistrationView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.tryoutRegistration.findFirst({
        where: { id, deletedAt: null },
        include: REGISTRATION_INCLUDE
      });

      if (current === null) {
        throw AppError.notFound('Inscrição não encontrada.');
      }

      assertTransition(
        TRYOUT_REGISTRATION_TRANSITIONS,
        current.status,
        status,
        TRYOUT_REGISTRATION_LABELS
      );

      if (REASON_REQUIRED_REGISTRATION.has(status) && !reason) {
        throw AppError.validation('REASON_REQUIRED', 'Informe o motivo.');
      }

      const row = await tx.tryoutRegistration.update({
        where: { id },
        data: { status, reviewReason: reason, reviewedById: actor.userId, reviewedAt: new Date() },
        include: REGISTRATION_INCLUDE
      });

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'tryout_registration.status.changed',
          entityType: 'TryoutRegistration',
          entityId: id,
          reason,
          before: { status: current.status },
          after: { status },
          meta
        },
        tx
      );

      if (current.applicantUserId && (status === 'APPROVED' || status === 'REJECTED')) {
        await this.notifications.notify(
          {
            userId: current.applicantUserId,
            type: `tryout_registration.${status.toLowerCase()}`,
            title: status === 'APPROVED' ? 'Inscrição aprovada!' : 'Inscrição não aprovada',
            message:
              status === 'APPROVED'
                ? `Sua inscrição na seletiva "${current.tryout.title}" foi aprovada.`
                : `Sua inscrição na seletiva "${current.tryout.title}" não foi aprovada.`,
            link: '/minha-conta/inscricoes',
            deduplicationKey: `tryout-registration:${id}:${status}`
          },
          tx
        );
      }

      return row;
    });

    return toRegistrationView(updated);
  }

  /** Converte inscrição aprovada/compareceu em atleta, vinculando a origem (RN-ATL-004). */
  async convertRegistration(
    actor: Principal,
    id: string,
    athlete: AthleteInput,
    meta: RequestMeta
  ): Promise<AthleteDetail> {
    const athleteId = await this.prisma.$transaction(async (tx) => {
      const current = await tx.tryoutRegistration.findFirst({ where: { id, deletedAt: null } });

      if (current === null) {
        throw AppError.notFound('Inscrição não encontrada.');
      }

      if (current.status !== 'APPROVED' && current.status !== 'ATTENDED') {
        throw AppError.conflict(
          'NOT_APPROVED',
          'Somente inscrições aprovadas ou com comparecimento podem virar atleta.'
        );
      }

      if (current.athleteId) {
        throw AppError.conflict('ALREADY_ATHLETE', 'Esta inscrição já está vinculada a um atleta.');
      }

      const createdId = await this.athletes.createInTx(tx, actor, athlete, meta, {
        type: 'TryoutRegistration',
        id
      });

      await tx.tryoutRegistration.update({ where: { id }, data: { athleteId: createdId } });

      return createdId;
    });

    return this.athletes.get(athleteId);
  }
}
