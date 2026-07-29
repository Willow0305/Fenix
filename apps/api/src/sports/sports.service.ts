import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  AthleteProfileStatus,
  GuardianAuthorizationStatus,
  Prisma,
  PrivateAttachmentStatus,
  TryoutRegistrationStatus,
  TryoutStatus
} from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { normalizeEmail } from '../common/security/security';
import { ApplicationConfig } from '../config/application.config';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateAthleteAffiliationDto,
  CreateAthleteDto,
  UpdateAthleteDto
} from './dto/athlete.dto';
import type { CreateSportCategoryDto, UpdateSportCategoryDto } from './dto/category.dto';
import type {
  CreateGuardianDto,
  GuardianAuthorizationMetadataDto,
  LinkGuardianDto
} from './dto/guardian.dto';
import type { SportsQueryDto } from './dto/sports-query.dto';
import type { CreateTeamDto, LinkTeamCategoryDto, UpdateTeamDto } from './dto/team.dto';
import type {
  ConvertTryoutRegistrationDto,
  CreateTryoutDto,
  CreateTryoutRegistrationDto,
  UpdateTryoutDto,
  UpdateTryoutRegistrationStatusDto
} from './dto/tryout.dto';
import {
  createAthleteDuplicateFingerprint,
  evaluateAthleteProtection,
  formatCivilDate,
  isMinorOnCivilDate,
  isTryoutRegistrationTransitionAllowed,
  parseCivilDate,
  type TryoutRegistrationStatus as DomainRegistrationStatus
} from './domain';

const athleteRelations = {
  affiliations: {
    include: {
      teamCategory: {
        include: {
          category: true,
          team: true
        }
      }
    },
    orderBy: [{ startsOn: 'desc' }, { id: 'desc' }]
  },
  guardianAuthorizations: {
    include: {
      privateAttachment: true
    }
  },
  guardians: true
} as const satisfies Prisma.AthleteProfileInclude;

const guardianRelations = {
  athleteLinks: {
    include: {
      athleteProfile: {
        include: {
          guardianAuthorizations: true
        }
      }
    }
  }
} as const satisfies Prisma.GuardianInclude;

const teamRelations = {
  categories: {
    include: {
      affiliations: true,
      category: true
    },
    orderBy: [{ startsOn: 'desc' }, { id: 'desc' }]
  }
} as const satisfies Prisma.TeamInclude;

const tryoutRelations = {
  registrations: {
    select: {
      status: true
    }
  },
  teamCategory: {
    include: {
      category: true,
      team: true
    }
  }
} as const satisfies Prisma.TryoutInclude;

const registrationRelations = {
  guardianAuthorizations: {
    include: {
      privateAttachment: true
    }
  },
  tryout: {
    include: {
      teamCategory: {
        include: {
          category: true,
          team: true
        }
      }
    }
  }
} as const satisfies Prisma.TryoutRegistrationInclude;

type AthleteWithRelations = Prisma.AthleteProfileGetPayload<{
  include: typeof athleteRelations;
}>;
type GuardianWithRelations = Prisma.GuardianGetPayload<{
  include: typeof guardianRelations;
}>;
type TeamWithRelations = Prisma.TeamGetPayload<{ include: typeof teamRelations }>;
type TryoutWithRelations = Prisma.TryoutGetPayload<{ include: typeof tryoutRelations }>;
type RegistrationWithRelations = Prisma.TryoutRegistrationGetPayload<{
  include: typeof registrationRelations;
}>;

const OCCUPIED_REGISTRATION_STATUSES: readonly TryoutRegistrationStatus[] = [
  TryoutRegistrationStatus.APPROVED,
  TryoutRegistrationStatus.ATTENDED,
  TryoutRegistrationStatus.CONVERTED
];
const MAX_SERIALIZABLE_ATTEMPTS = 3;

function toCivilDate(value: string): Date {
  const parsed = parseCivilDate(value);

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function civilDateFromDate(value: Date): string {
  return formatCivilDate({
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate()
  });
}

function todayCivilDate(): Date {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 50);
}

function ensureGeneratedIdentifier(value: string, field: 'code' | 'slug'): string {
  if (!value) {
    throw new BadRequestException({
      code: 'SPORT_IDENTIFIER_INVALID',
      message: `Não foi possível gerar ${field} a partir do nome informado.`
    });
  }

  return value;
}

function ensurePeriod(startsOn: Date, endsOn?: Date): void {
  if (endsOn && endsOn < startsOn) {
    throw new BadRequestException({
      code: 'INVALID_CIVIL_DATE_PERIOD',
      message: 'A data final não pode anteceder a data inicial.'
    });
  }
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isSerializableConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === 'P2034') {
    return true;
  }

  return error.code === 'P2010' && error.meta?.['code'] === '40001';
}

function duplicateConflict(): ConflictException {
  return new ConflictException({
    code: 'SPORT_RECORD_ALREADY_EXISTS',
    message: 'Já existe um registro esportivo com o identificador informado.'
  });
}

@Injectable()
export class SportsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly applicationConfig: ApplicationConfig
  ) {}

  public async summary() {
    const [categories, teams, athletes, guardians, tryouts, registrations] = await Promise.all([
      this.prisma.category.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.team.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.athleteProfile.count({ where: { deletedAt: null } }),
      this.prisma.guardian.count({ where: { deletedAt: null } }),
      this.prisma.tryout.count({ where: { deletedAt: null } }),
      this.prisma.tryoutRegistration.count({ where: { deletedAt: null } })
    ]);

    return {
      categories,
      teams,
      athletes,
      guardians,
      tryouts,
      registrations,
      dataScope: 'FICTITIOUS_ONLY'
    };
  }

  public async listCategories(input: SportsQueryDto) {
    const records = await this.prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            teamCategories: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;

    return {
      data: page.map((category) => ({
        id: category.id,
        code: category.code,
        name: category.name,
        slug: category.slug,
        kind: category.kind,
        description: category.description,
        minimumAge: category.minimumAge,
        maximumAge: category.maximumAge,
        isActive: category.isActive,
        teamsCount: category._count.teamCategories
      })),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? page.at(-1)?.id : undefined
      }
    };
  }

  public async createCategory(
    input: CreateSportCategoryDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    this.ensureCategoryAges(input.minimumAge, input.maximumAge);
    const code = ensureGeneratedIdentifier(normalizeCode(input.code ?? input.name), 'code');
    const slug = ensureGeneratedIdentifier(normalizeSlug(input.slug ?? input.name), 'slug');

    try {
      return await this.prisma.$transaction(async (database) => {
        const category = await database.category.create({
          data: {
            code,
            name: input.name.trim(),
            slug,
            kind: input.kind,
            ...(input.minimumAge !== undefined ? { minimumAge: input.minimumAge } : {}),
            ...(input.maximumAge !== undefined ? { maximumAge: input.maximumAge } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.categoryCreated,
            actorUserId,
            entityType: 'Category',
            entityId: category.id,
            afterData: {
              code: category.code,
              kind: category.kind,
              isActive: category.isActive
            },
            request
          },
          database
        );

        return {
          ...category,
          teamsCount: 0
        };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async updateCategory(
    categoryId: string,
    input: UpdateSportCategoryDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const category = await this.findCategory(categoryId);
    this.ensureCategoryAges(
      input.minimumAge ?? category.minimumAge ?? undefined,
      input.maximumAge ?? category.maximumAge ?? undefined
    );

    try {
      return await this.prisma.$transaction(async (database) => {
        const updated = await database.category.update({
          where: { id: categoryId },
          data: {
            ...(input.code
              ? { code: ensureGeneratedIdentifier(normalizeCode(input.code), 'code') }
              : {}),
            ...(input.name ? { name: input.name.trim() } : {}),
            ...(input.slug
              ? { slug: ensureGeneratedIdentifier(normalizeSlug(input.slug), 'slug') }
              : {}),
            ...(input.kind ? { kind: input.kind } : {}),
            ...(input.minimumAge !== undefined ? { minimumAge: input.minimumAge } : {}),
            ...(input.maximumAge !== undefined ? { maximumAge: input.maximumAge } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.categoryUpdated,
            actorUserId,
            entityType: 'Category',
            entityId: categoryId,
            beforeData: {
              kind: category.kind,
              isActive: category.isActive
            },
            afterData: {
              kind: updated.kind,
              isActive: updated.isActive
            },
            request
          },
          database
        );

        return updated;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listTeams(input: SportsQueryDto) {
    const records = await this.prisma.team.findMany({
      where: { deletedAt: null },
      include: teamRelations,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;

    return {
      data: page.map((team) => this.mapTeam(team)),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? page.at(-1)?.id : undefined
      }
    };
  }

  public async createTeam(
    input: CreateTeamDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const code = ensureGeneratedIdentifier(normalizeCode(input.name), 'code');
    const slug = ensureGeneratedIdentifier(normalizeSlug(input.slug ?? input.name), 'slug');
    const categoryIds = [...new Set(input.categoryIds ?? [])];

    if (categoryIds.length > 0) {
      await this.ensureCategoriesExist(categoryIds);
    }

    try {
      const teamId = await this.prisma.$transaction(async (database) => {
        const team = await database.team.create({
          data: {
            code,
            name: input.name.trim(),
            slug,
            description: normalizeOptionalText(input.description),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
          }
        });
        const startsOn = todayCivilDate();

        if (categoryIds.length > 0) {
          await database.teamCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              teamId: team.id,
              categoryId,
              startsOn,
              createdById: actorUserId
            }))
          });
        }
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.teamCreated,
            actorUserId,
            entityType: 'Team',
            entityId: team.id,
            afterData: {
              code: team.code,
              isActive: team.isActive,
              categoryLinksCreated: categoryIds.length
            },
            request
          },
          database
        );

        return team.id;
      });

      return this.findTeam(teamId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async updateTeam(
    teamId: string,
    input: UpdateTeamDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const team = await this.findTeamEntity(teamId);

    try {
      await this.prisma.$transaction(async (database) => {
        const updated = await database.team.update({
          where: { id: teamId },
          data: {
            ...(input.name ? { name: input.name.trim() } : {}),
            ...(input.slug
              ? { slug: ensureGeneratedIdentifier(normalizeSlug(input.slug), 'slug') }
              : {}),
            ...(input.description !== undefined
              ? { description: normalizeOptionalText(input.description) }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.teamUpdated,
            actorUserId,
            entityType: 'Team',
            entityId: teamId,
            beforeData: { isActive: team.isActive },
            afterData: { isActive: updated.isActive },
            request
          },
          database
        );
      });

      return this.findTeam(teamId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async linkTeamCategory(
    teamId: string,
    input: LinkTeamCategoryDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await Promise.all([this.findTeamEntity(teamId), this.findCategory(input.categoryId)]);
    const startsOn = toCivilDate(input.startsOn);
    const endsOn = input.endsOn ? toCivilDate(input.endsOn) : undefined;
    ensurePeriod(startsOn, endsOn);
    const overlap = await this.prisma.teamCategory.findFirst({
      where: {
        teamId,
        categoryId: input.categoryId,
        deletedAt: null,
        ...(endsOn ? { startsOn: { lte: endsOn } } : {}),
        OR: [{ endsOn: null }, { endsOn: { gte: startsOn } }]
      }
    });

    if (overlap) {
      throw new ConflictException({
        code: 'TEAM_CATEGORY_PERIOD_OVERLAP',
        message: 'Já existe um vínculo dessa equipe e categoria no período informado.'
      });
    }

    try {
      return await this.prisma.$transaction(async (database) => {
        const link = await database.teamCategory.create({
          data: {
            teamId,
            categoryId: input.categoryId,
            startsOn,
            ...(endsOn ? { endsOn } : {}),
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.teamCategoryLinked,
            actorUserId,
            entityType: 'TeamCategory',
            entityId: link.id,
            afterData: {
              teamId,
              categoryId: input.categoryId,
              startsOn: input.startsOn,
              endsOn: input.endsOn ?? null
            },
            request
          },
          database
        );

        return link;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listAthletes(input: SportsQueryDto) {
    const records = await this.prisma.athleteProfile.findMany({
      where: { deletedAt: null },
      include: athleteRelations,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;
    const duplicateCounts = await this.findDuplicateCounts(
      page.map(({ duplicateFingerprintHash }) => duplicateFingerprintHash),
      'athlete'
    );

    return {
      data: page.map((athlete) =>
        this.mapAthlete(athlete, (duplicateCounts.get(athlete.duplicateFingerprintHash) ?? 0) > 1)
      ),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? page.at(-1)?.id : undefined
      }
    };
  }

  public async createAthlete(
    input: CreateAthleteDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    this.ensureFictitious(input.isFictitious);
    const birthDate = toCivilDate(input.birthDate);
    const isMinor = this.isMinor(input.birthDate);
    const fingerprint = createAthleteDuplicateFingerprint(
      {
        fullName: input.fullName,
        birthDate: input.birthDate
      },
      this.applicationConfig.sportsDuplicateHmacKey
    );
    const duplicateCount = await this.prisma.athleteProfile.count({
      where: {
        duplicateFingerprintHash: fingerprint,
        deletedAt: null
      }
    });
    const authorization = isMinor
      ? await this.validateAuthorizationMetadata(input.guardianAuthorization)
      : null;

    try {
      const athleteId = await this.prisma.$transaction(
        async (database) => {
          const athlete = await database.athleteProfile.create({
            data: {
              ...(input.userId ? { userId: input.userId } : {}),
              fullName: input.fullName.trim(),
              preferredName: normalizeOptionalText(input.preferredName),
              birthDate,
              position: normalizeOptionalText(input.position),
              status: input.status ?? AthleteProfileStatus.PENDING,
              duplicateFingerprintHash: fingerprint,
              isFictitious: true
            }
          });

          if (authorization) {
            await database.athleteGuardian.create({
              data: {
                athleteProfileId: athlete.id,
                guardianId: authorization.guardian.id,
                relationship: authorization.input.relationship.trim(),
                startsOn: todayCivilDate(),
                createdById: actorUserId
              }
            });
            const guardianAuthorization = await database.guardianAuthorization.create({
              data: {
                guardianId: authorization.guardian.id,
                athleteProfileId: athlete.id,
                privateAttachmentId: authorization.attachment.id,
                version: authorization.input.version.trim(),
                relationship: authorization.input.relationship.trim(),
                status: GuardianAuthorizationStatus.VALID,
                validFrom: authorization.validFrom,
                validUntil: authorization.validUntil,
                verifiedAt: new Date(),
                verifiedById: actorUserId
              }
            });
            await this.audit.record(
              {
                action: AUDIT_ACTIONS.guardianAuthorizationRecorded,
                actorUserId,
                entityType: 'GuardianAuthorization',
                entityId: guardianAuthorization.id,
                afterData: {
                  athleteProfileId: athlete.id,
                  status: GuardianAuthorizationStatus.VALID,
                  version: authorization.input.version
                },
                request
              },
              database
            );
          }

          await this.audit.record(
            {
              action: AUDIT_ACTIONS.athleteCreated,
              actorUserId,
              entityType: 'AthleteProfile',
              entityId: athlete.id,
              afterData: {
                status: athlete.status,
                isFictitious: true,
                isMinor,
                duplicateWarning: duplicateCount > 0
              },
              request
            },
            database
          );

          if (duplicateCount > 0) {
            await this.audit.record(
              {
                action: AUDIT_ACTIONS.athleteDuplicateDetected,
                actorUserId,
                entityType: 'AthleteProfile',
                entityId: athlete.id,
                metadata: {
                  candidateCount: duplicateCount,
                  automaticMergePerformed: false
                },
                request
              },
              database
            );
          }

          return athlete.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return this.getMappedAthlete(athleteId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async updateAthlete(
    athleteId: string,
    input: UpdateAthleteDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const athlete = await this.findAthlete(athleteId);
    const nextFullName = input.fullName?.trim() ?? athlete.fullName;
    const nextBirthDate = input.birthDate ?? civilDateFromDate(athlete.birthDate);
    const isMinor = this.isMinor(nextBirthDate);

    if (isMinor) {
      const protection = this.evaluateStoredProtection(athlete);

      if (!protection.allowed) {
        throw new ConflictException({
          code: 'MINOR_PROTECTION_REQUIRED',
          message:
            'Atleta fictício menor exige vínculo de responsável e autorização protegida válida.'
        });
      }
    }

    const fingerprint = createAthleteDuplicateFingerprint(
      {
        fullName: nextFullName,
        birthDate: nextBirthDate
      },
      this.applicationConfig.sportsDuplicateHmacKey
    );
    const duplicateCount = await this.prisma.athleteProfile.count({
      where: {
        duplicateFingerprintHash: fingerprint,
        deletedAt: null,
        id: { not: athleteId }
      }
    });

    try {
      await this.prisma.$transaction(async (database) => {
        const updated = await database.athleteProfile.update({
          where: { id: athleteId },
          data: {
            ...(input.userId !== undefined ? { userId: input.userId } : {}),
            ...(input.fullName ? { fullName: input.fullName.trim() } : {}),
            ...(input.preferredName !== undefined
              ? { preferredName: normalizeOptionalText(input.preferredName) }
              : {}),
            ...(input.birthDate ? { birthDate: toCivilDate(input.birthDate) } : {}),
            ...(input.position !== undefined
              ? { position: normalizeOptionalText(input.position) }
              : {}),
            ...(input.status ? { status: input.status } : {}),
            duplicateFingerprintHash: fingerprint
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.athleteUpdated,
            actorUserId,
            entityType: 'AthleteProfile',
            entityId: athleteId,
            beforeData: { status: athlete.status },
            afterData: {
              status: updated.status,
              isMinor,
              duplicateWarning: duplicateCount > 0
            },
            request
          },
          database
        );

        if (duplicateCount > 0) {
          await this.audit.record(
            {
              action: AUDIT_ACTIONS.athleteDuplicateDetected,
              actorUserId,
              entityType: 'AthleteProfile',
              entityId: athleteId,
              metadata: {
                candidateCount: duplicateCount,
                automaticMergePerformed: false
              },
              request
            },
            database
          );
        }
      });

      return this.getMappedAthlete(athleteId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async createAffiliation(
    athleteId: string,
    input: CreateAthleteAffiliationDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await Promise.all([this.findAthlete(athleteId), this.findTeamCategory(input.teamCategoryId)]);
    const startsOn = toCivilDate(input.startsOn);
    const endsOn = input.endsOn ? toCivilDate(input.endsOn) : undefined;
    ensurePeriod(startsOn, endsOn);
    const overlap = await this.prisma.athleteAffiliation.findFirst({
      where: {
        athleteProfileId: athleteId,
        teamCategoryId: input.teamCategoryId,
        ...(endsOn ? { startsOn: { lte: endsOn } } : {}),
        OR: [{ endsOn: null }, { endsOn: { gte: startsOn } }]
      }
    });

    if (overlap) {
      throw new ConflictException({
        code: 'ATHLETE_AFFILIATION_PERIOD_OVERLAP',
        message: 'O vínculo informado se sobrepõe ao histórico existente.'
      });
    }

    try {
      return await this.prisma.$transaction(async (database) => {
        const affiliation = await database.athleteAffiliation.create({
          data: {
            athleteProfileId: athleteId,
            teamCategoryId: input.teamCategoryId,
            startsOn,
            ...(endsOn ? { endsOn, endedById: actorUserId } : {}),
            assignedById: actorUserId,
            reason: normalizeOptionalText(input.reason)
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.athleteAffiliationCreated,
            actorUserId,
            entityType: 'AthleteAffiliation',
            entityId: affiliation.id,
            ...(normalizeOptionalText(input.reason)
              ? { reason: normalizeOptionalText(input.reason) ?? '' }
              : {}),
            afterData: {
              athleteProfileId: athleteId,
              teamCategoryId: input.teamCategoryId,
              startsOn: input.startsOn,
              endsOn: input.endsOn ?? null
            },
            request
          },
          database
        );

        return affiliation;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listGuardians(input: SportsQueryDto) {
    const records = await this.prisma.guardian.findMany({
      where: { deletedAt: null },
      include: guardianRelations,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;

    return {
      data: page.map((guardian) => this.mapGuardian(guardian)),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? page.at(-1)?.id : undefined
      }
    };
  }

  public async createGuardian(
    input: CreateGuardianDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    this.ensureFictitious(input.isFictitious);
    const email = input.email ? normalizeEmail(input.email) : null;
    const phone = normalizeOptionalText(input.phone);

    if (!email && !phone) {
      throw new BadRequestException({
        code: 'GUARDIAN_CONTACT_REQUIRED',
        message: 'Informe ao menos um contato fictício do responsável.'
      });
    }

    return this.prisma.$transaction(async (database) => {
      const guardian = await database.guardian.create({
        data: {
          fullName: input.fullName.trim(),
          email,
          phone,
          isFictitious: true
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.guardianCreated,
          actorUserId,
          entityType: 'Guardian',
          entityId: guardian.id,
          afterData: {
            isFictitious: true,
            hasEmail: Boolean(email),
            hasPhone: Boolean(phone)
          },
          request
        },
        database
      );

      return {
        id: guardian.id,
        fullName: guardian.fullName,
        email: guardian.email,
        phone: guardian.phone,
        athletes: []
      };
    });
  }

  public async linkGuardian(
    athleteId: string,
    input: LinkGuardianDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const [athlete, guardian] = await Promise.all([
      this.findAthlete(athleteId),
      this.findGuardian(input.guardianId)
    ]);
    this.ensureFictitious(athlete.isFictitious && guardian.isFictitious);
    const startsOn = toCivilDate(input.startsOn);

    try {
      return await this.prisma.$transaction(async (database) => {
        const link = await database.athleteGuardian.create({
          data: {
            athleteProfileId: athleteId,
            guardianId: input.guardianId,
            relationship: input.relationship.trim(),
            startsOn,
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.guardianLinked,
            actorUserId,
            entityType: 'AthleteGuardian',
            entityId: link.id,
            afterData: {
              athleteProfileId: athleteId,
              guardianId: input.guardianId,
              startsOn: input.startsOn
            },
            request
          },
          database
        );

        return link;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listTryouts(input: SportsQueryDto) {
    const records = await this.prisma.tryout.findMany({
      where: { deletedAt: null },
      include: tryoutRelations,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;

    return {
      data: page.map((tryout) => this.mapTryout(tryout)),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? page.at(-1)?.id : undefined
      }
    };
  }

  public async createTryout(
    input: CreateTryoutDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const teamCategory = await this.resolveTeamCategory(input);
    const startsAt = new Date(input.startsAt);
    const registrationStartsAt = new Date(input.registrationStartsAt);
    const registrationEndsAt = new Date(input.registrationEndsAt);
    this.ensureTryoutWindow(registrationStartsAt, registrationEndsAt, startsAt);
    const slug = ensureGeneratedIdentifier(normalizeSlug(input.slug ?? input.title), 'slug');

    try {
      const tryoutId = await this.prisma.$transaction(async (database) => {
        const tryout = await database.tryout.create({
          data: {
            teamCategoryId: teamCategory.id,
            title: input.title.trim(),
            slug,
            description: normalizeOptionalText(input.description),
            location: input.location.trim(),
            startsAt,
            registrationStartsAt,
            registrationEndsAt,
            capacity: input.capacity,
            ...(input.waitlistCapacity !== undefined
              ? { waitlistCapacity: input.waitlistCapacity }
              : {}),
            responsibleUserId: actorUserId,
            criteria: normalizeOptionalText(input.criteria),
            status: input.status ?? TryoutStatus.DRAFT
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.tryoutCreated,
            actorUserId,
            entityType: 'Tryout',
            entityId: tryout.id,
            afterData: {
              teamCategoryId: tryout.teamCategoryId,
              status: tryout.status,
              capacity: tryout.capacity,
              waitlistCapacity: tryout.waitlistCapacity
            },
            request
          },
          database
        );

        return tryout.id;
      });

      return this.findTryout(tryoutId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async updateTryout(
    tryoutId: string,
    input: UpdateTryoutDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const tryout = await this.findTryoutEntity(tryoutId);
    const startsAt = input.startsAt ? new Date(input.startsAt) : tryout.startsAt;
    const registrationStartsAt = input.registrationStartsAt
      ? new Date(input.registrationStartsAt)
      : tryout.registrationStartsAt;
    const registrationEndsAt = input.registrationEndsAt
      ? new Date(input.registrationEndsAt)
      : tryout.registrationEndsAt;
    this.ensureTryoutWindow(registrationStartsAt, registrationEndsAt, startsAt);
    const teamCategory =
      input.teamCategoryId || (input.teamId && input.categoryId)
        ? await this.resolveTeamCategory(input)
        : null;

    try {
      await this.prisma.$transaction(async (database) => {
        const updated = await database.tryout.update({
          where: { id: tryoutId },
          data: {
            ...(teamCategory ? { teamCategoryId: teamCategory.id } : {}),
            ...(input.title ? { title: input.title.trim() } : {}),
            ...(input.slug
              ? { slug: ensureGeneratedIdentifier(normalizeSlug(input.slug), 'slug') }
              : {}),
            ...(input.description !== undefined
              ? { description: normalizeOptionalText(input.description) }
              : {}),
            ...(input.location ? { location: input.location.trim() } : {}),
            startsAt,
            registrationStartsAt,
            registrationEndsAt,
            ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
            ...(input.waitlistCapacity !== undefined
              ? { waitlistCapacity: input.waitlistCapacity }
              : {}),
            ...(input.criteria !== undefined
              ? { criteria: normalizeOptionalText(input.criteria) }
              : {}),
            ...(input.status ? { status: input.status } : {})
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.tryoutUpdated,
            actorUserId,
            entityType: 'Tryout',
            entityId: tryoutId,
            beforeData: {
              status: tryout.status,
              capacity: tryout.capacity,
              waitlistCapacity: tryout.waitlistCapacity
            },
            afterData: {
              status: updated.status,
              capacity: updated.capacity,
              waitlistCapacity: updated.waitlistCapacity
            },
            request
          },
          database
        );
      });

      return this.findTryout(tryoutId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listRegistrations(input: SportsQueryDto) {
    const records = await this.prisma.tryoutRegistration.findMany({
      where: { deletedAt: null },
      include: registrationRelations,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
    });
    const hasNextPage = records.length > input.limit;
    const page = hasNextPage ? records.slice(0, input.limit) : records;
    const registrationCounts = await this.findDuplicateCounts(
      page.map(({ duplicateFingerprintHash }) => duplicateFingerprintHash),
      'registration'
    );
    const athleteCounts = await this.findDuplicateCounts(
      page.map(({ duplicateFingerprintHash }) => duplicateFingerprintHash),
      'athlete'
    );

    return {
      data: page.map((registration) =>
        this.mapRegistration(
          registration,
          (registrationCounts.get(registration.duplicateFingerprintHash) ?? 0) > 1 ||
            (athleteCounts.get(registration.duplicateFingerprintHash) ?? 0) > 0
        )
      ),
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? page.at(-1)?.id : undefined
      }
    };
  }

  public async createRegistration(
    input: CreateTryoutRegistrationDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    this.ensureFictitious(input.isFictitious);
    const tryout = await this.findTryoutEntity(input.tryoutId);
    const now = new Date();

    if (
      tryout.status !== TryoutStatus.OPEN ||
      now < tryout.registrationStartsAt ||
      now > tryout.registrationEndsAt
    ) {
      throw new ConflictException({
        code: 'TRYOUT_REGISTRATION_CLOSED',
        message: 'A seletiva não está apta a receber inscrições neste instante.'
      });
    }

    const birthDate = toCivilDate(input.birthDate);
    const isMinor = this.isMinor(input.birthDate);
    const fingerprint = createAthleteDuplicateFingerprint(
      {
        fullName: input.fullName,
        birthDate: input.birthDate
      },
      this.applicationConfig.sportsDuplicateHmacKey
    );
    const [registrationDuplicates, athleteDuplicates] = await Promise.all([
      this.prisma.tryoutRegistration.count({
        where: {
          duplicateFingerprintHash: fingerprint,
          deletedAt: null
        }
      }),
      this.prisma.athleteProfile.count({
        where: {
          duplicateFingerprintHash: fingerprint,
          deletedAt: null
        }
      })
    ]);
    const authorization = isMinor
      ? await this.validateAuthorizationMetadata(input.guardianAuthorization)
      : null;

    try {
      const registrationId = await this.withSerializableRetry(async (database) => {
        await database.$queryRaw`
          SELECT "id"
          FROM "tryouts"
          WHERE "id" = ${tryout.id}::uuid
          FOR UPDATE
        `;
        const currentTryout = await database.tryout.findUnique({
          where: { id: tryout.id }
        });
        const currentTime = new Date();

        if (
          !currentTryout ||
          currentTryout.deletedAt ||
          currentTryout.status !== TryoutStatus.OPEN ||
          currentTime < currentTryout.registrationStartsAt ||
          currentTime > currentTryout.registrationEndsAt
        ) {
          throw new ConflictException({
            code: 'TRYOUT_REGISTRATION_CLOSED',
            message: 'A seletiva não está apta a receber inscrições neste instante.'
          });
        }

        const registration = await database.tryoutRegistration.create({
          data: {
            tryoutId: tryout.id,
            fullName: input.fullName.trim(),
            birthDate,
            email: input.email ? normalizeEmail(input.email) : null,
            phone: normalizeOptionalText(input.phone),
            desiredPosition: normalizeOptionalText(input.desiredPosition),
            duplicateFingerprintHash: fingerprint,
            isFictitious: true
          }
        });
        await database.tryoutRegistrationHistory.create({
          data: {
            registrationId: registration.id,
            toStatus: TryoutRegistrationStatus.NEW,
            changedById: actorUserId,
            reason: 'REGISTRATION_CREATED'
          }
        });

        if (authorization) {
          const createdAuthorization = await database.guardianAuthorization.create({
            data: {
              guardianId: authorization.guardian.id,
              tryoutRegistrationId: registration.id,
              privateAttachmentId: authorization.attachment.id,
              version: authorization.input.version.trim(),
              relationship: authorization.input.relationship.trim(),
              status: GuardianAuthorizationStatus.VALID,
              validFrom: authorization.validFrom,
              validUntil: authorization.validUntil,
              verifiedAt: currentTime,
              verifiedById: actorUserId
            }
          });
          await this.audit.record(
            {
              action: AUDIT_ACTIONS.guardianAuthorizationRecorded,
              actorUserId,
              entityType: 'GuardianAuthorization',
              entityId: createdAuthorization.id,
              afterData: {
                tryoutRegistrationId: registration.id,
                status: GuardianAuthorizationStatus.VALID,
                version: authorization.input.version
              },
              request
            },
            database
          );
        }

        const duplicateWarning = registrationDuplicates + athleteDuplicates > 0;
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.tryoutRegistrationCreated,
            actorUserId,
            entityType: 'TryoutRegistration',
            entityId: registration.id,
            afterData: {
              tryoutId: tryout.id,
              status: TryoutRegistrationStatus.NEW,
              isFictitious: true,
              isMinor,
              duplicateWarning
            },
            request
          },
          database
        );

        if (duplicateWarning) {
          await this.audit.record(
            {
              action: AUDIT_ACTIONS.athleteDuplicateDetected,
              actorUserId,
              entityType: 'TryoutRegistration',
              entityId: registration.id,
              metadata: {
                candidateCount: registrationDuplicates + athleteDuplicates,
                automaticMergePerformed: false
              },
              request
            },
            database
          );
        }

        return registration.id;
      });

      return this.getMappedRegistration(registrationId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async updateRegistrationStatus(
    registrationId: string,
    input: UpdateTryoutRegistrationStatusDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      await database.$queryRaw`
        SELECT "id"
        FROM "tryout_registrations"
        WHERE "id" = ${registrationId}::uuid
        FOR UPDATE
      `;
      const registration = await database.tryoutRegistration.findUnique({
        where: { id: registrationId },
        include: { tryout: true }
      });

      if (!registration || registration.deletedAt) {
        throw this.notFound('TRYOUT_REGISTRATION_NOT_FOUND', 'Inscrição não encontrada.');
      }

      if (
        !isTryoutRegistrationTransitionAllowed(
          registration.status as DomainRegistrationStatus,
          input.status as DomainRegistrationStatus
        )
      ) {
        throw new ConflictException({
          code: 'TRYOUT_REGISTRATION_TRANSITION_INVALID',
          message: 'A transição de estado informada não é permitida.'
        });
      }

      if (input.status === TryoutRegistrationStatus.APPROVED) {
        const occupied = await database.tryoutRegistration.count({
          where: {
            tryoutId: registration.tryoutId,
            status: { in: [...OCCUPIED_REGISTRATION_STATUSES] },
            deletedAt: null
          }
        });

        if (occupied >= registration.tryout.capacity) {
          throw new ConflictException({
            code: 'TRYOUT_CAPACITY_REACHED',
            message: 'As vagas da seletiva estão preenchidas; use a lista de espera.'
          });
        }
      }

      if (input.status === TryoutRegistrationStatus.WAITLISTED) {
        const waitlistCapacity = registration.tryout.waitlistCapacity ?? 0;
        const waiting = await database.tryoutRegistration.count({
          where: {
            tryoutId: registration.tryoutId,
            status: TryoutRegistrationStatus.WAITLISTED,
            deletedAt: null
          }
        });

        if (waitlistCapacity === 0 || waiting >= waitlistCapacity) {
          throw new ConflictException({
            code: 'TRYOUT_WAITLIST_CAPACITY_REACHED',
            message: 'A lista de espera não possui vagas disponíveis.'
          });
        }
      }

      const updated = await database.tryoutRegistration.update({
        where: { id: registrationId },
        data: {
          status: input.status,
          reviewedAt: new Date(),
          reviewedById: actorUserId,
          reviewReason: input.reason.trim()
        }
      });
      await database.tryoutRegistrationHistory.create({
        data: {
          registrationId,
          fromStatus: registration.status,
          toStatus: updated.status,
          changedById: actorUserId,
          reason: input.reason.trim()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.tryoutRegistrationStatusChanged,
          actorUserId,
          entityType: 'TryoutRegistration',
          entityId: registrationId,
          reason: input.reason.trim(),
          beforeData: { status: registration.status },
          afterData: { status: updated.status },
          request
        },
        database
      );
    });

    return this.getMappedRegistration(registrationId);
  }

  public async convertRegistration(
    registrationId: string,
    input: ConvertTryoutRegistrationDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const teamCategory = await this.resolveTeamCategory(input);
    const affiliationStartsOn = input.affiliationStartsOn
      ? toCivilDate(input.affiliationStartsOn)
      : todayCivilDate();
    const athleteId = await this.withSerializableRetry(async (database) => {
      await database.$queryRaw`
        SELECT "id"
        FROM "tryout_registrations"
        WHERE "id" = ${registrationId}::uuid
        FOR UPDATE
      `;
      const registration = await database.tryoutRegistration.findUnique({
        where: { id: registrationId },
        include: {
          guardianAuthorizations: {
            include: {
              guardian: true,
              privateAttachment: true
            }
          }
        }
      });

      if (!registration || registration.deletedAt) {
        throw this.notFound('TRYOUT_REGISTRATION_NOT_FOUND', 'Inscrição não encontrada.');
      }

      if (registration.convertedAthleteProfileId) {
        return registration.convertedAthleteProfileId;
      }

      if (
        !isTryoutRegistrationTransitionAllowed(
          registration.status as DomainRegistrationStatus,
          TryoutRegistrationStatus.CONVERTED
        )
      ) {
        throw new ConflictException({
          code: 'TRYOUT_REGISTRATION_NOT_CONVERTIBLE',
          message: 'Somente inscrição aprovada ou com presença registrada pode virar atleta.'
        });
      }

      const duplicate = await database.athleteProfile.count({
        where: {
          duplicateFingerprintHash: registration.duplicateFingerprintHash,
          deletedAt: null
        }
      });

      if (duplicate > 0) {
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.athleteDuplicateDetected,
            actorUserId,
            entityType: 'TryoutRegistration',
            entityId: registration.id,
            metadata: {
              candidateCount: duplicate,
              automaticMergePerformed: false,
              conversionBlocked: true
            },
            request
          },
          database
        );
        throw new ConflictException({
          code: 'POSSIBLE_ATHLETE_DUPLICATE_REQUIRES_REVIEW',
          message: 'Possível duplicidade exige análise humana; nenhuma fusão foi realizada.'
        });
      }

      const birthDate = civilDateFromDate(registration.birthDate);
      const isMinor = this.isMinor(birthDate);
      const validAuthorization = registration.guardianAuthorizations.find((authorization) =>
        this.isAuthorizationValid(authorization)
      );
      const protection = evaluateAthleteProtection({
        birthDate,
        referenceDate: civilDateFromDate(todayCivilDate()),
        hasGuardianLink: Boolean(validAuthorization),
        hasValidGuardianAuthorization: Boolean(validAuthorization)
      });

      if (isMinor && !protection.allowed) {
        throw new ConflictException({
          code: 'MINOR_PROTECTION_REQUIRED',
          message: 'A conversão de menor exige responsável fictício e autorização protegida válida.'
        });
      }

      const athlete = await database.athleteProfile.create({
        data: {
          fullName: registration.fullName,
          birthDate: registration.birthDate,
          position: registration.desiredPosition,
          status: AthleteProfileStatus.ACTIVE,
          duplicateFingerprintHash: registration.duplicateFingerprintHash,
          isFictitious: true
        }
      });
      await database.athleteAffiliation.create({
        data: {
          athleteProfileId: athlete.id,
          teamCategoryId: teamCategory.id,
          startsOn: affiliationStartsOn,
          assignedById: actorUserId,
          reason: input.reason.trim()
        }
      });

      if (validAuthorization) {
        await database.athleteGuardian.create({
          data: {
            athleteProfileId: athlete.id,
            guardianId: validAuthorization.guardianId,
            relationship: validAuthorization.relationship,
            startsOn: affiliationStartsOn,
            createdById: actorUserId
          }
        });
        await database.guardianAuthorization.update({
          where: { id: validAuthorization.id },
          data: { athleteProfileId: athlete.id }
        });
      }

      await database.tryoutRegistration.update({
        where: { id: registration.id },
        data: {
          status: TryoutRegistrationStatus.CONVERTED,
          convertedAthleteProfileId: athlete.id,
          reviewedAt: new Date(),
          reviewedById: actorUserId,
          reviewReason: input.reason.trim()
        }
      });
      await database.tryoutRegistrationHistory.create({
        data: {
          registrationId: registration.id,
          fromStatus: registration.status,
          toStatus: TryoutRegistrationStatus.CONVERTED,
          changedById: actorUserId,
          reason: input.reason.trim()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.tryoutRegistrationConverted,
          actorUserId,
          entityType: 'TryoutRegistration',
          entityId: registration.id,
          reason: input.reason.trim(),
          afterData: {
            athleteProfileId: athlete.id,
            teamCategoryId: teamCategory.id,
            isMinor,
            automaticMergePerformed: false
          },
          request
        },
        database
      );

      return athlete.id;
    });

    return this.getMappedAthlete(athleteId);
  }

  private ensureCategoryAges(minimumAge?: number, maximumAge?: number): void {
    if (minimumAge !== undefined && maximumAge !== undefined && minimumAge > maximumAge) {
      throw new BadRequestException({
        code: 'SPORT_CATEGORY_AGE_RANGE_INVALID',
        message: 'A idade mínima não pode superar a idade máxima.'
      });
    }
  }

  private ensureFictitious(value: boolean): void {
    if (value !== true) {
      throw new ConflictException({
        code: 'REAL_SPORT_DATA_BLOCKED',
        message: 'A primeira entrega esportiva aceita somente dados explicitamente fictícios.'
      });
    }
  }

  private ensureTryoutWindow(
    registrationStartsAt: Date,
    registrationEndsAt: Date,
    startsAt: Date
  ): void {
    if (
      Number.isNaN(registrationStartsAt.getTime()) ||
      Number.isNaN(registrationEndsAt.getTime()) ||
      Number.isNaN(startsAt.getTime()) ||
      registrationStartsAt >= registrationEndsAt ||
      registrationEndsAt > startsAt
    ) {
      throw new BadRequestException({
        code: 'TRYOUT_WINDOW_INVALID',
        message: 'A janela de inscrição deve terminar antes do início da seletiva.'
      });
    }
  }

  private isMinor(birthDate: string): boolean {
    try {
      return isMinorOnCivilDate(birthDate, civilDateFromDate(todayCivilDate()));
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException({
          code: 'ATHLETE_BIRTH_DATE_INVALID',
          message: 'A data de nascimento civil é inválida.'
        });
      }

      throw error;
    }
  }

  private async validateAuthorizationMetadata(input: GuardianAuthorizationMetadataDto | undefined) {
    if (!input) {
      throw new ConflictException({
        code: 'MINOR_PROTECTION_REQUIRED',
        message: 'Registro fictício de menor exige responsável e metadado de autorização protegida.'
      });
    }

    const [guardian, attachment] = await Promise.all([
      this.findGuardian(input.guardianId),
      this.prisma.privateAttachment.findUnique({
        where: { id: input.privateAttachmentId }
      })
    ]);

    if (
      !attachment ||
      attachment.removedAt ||
      attachment.status !== PrivateAttachmentStatus.AVAILABLE
    ) {
      throw new ConflictException({
        code: 'GUARDIAN_AUTHORIZATION_ATTACHMENT_UNAVAILABLE',
        message: 'O metadado privado da autorização não está disponível.'
      });
    }

    this.ensureFictitious(guardian.isFictitious);
    const validFrom = toCivilDate(input.validFrom);
    const validUntil = toCivilDate(input.validUntil);
    ensurePeriod(validFrom, validUntil);
    const today = todayCivilDate();

    if (validFrom > today || validUntil < today) {
      throw new ConflictException({
        code: 'GUARDIAN_AUTHORIZATION_NOT_CURRENT',
        message: 'A autorização informada não está vigente na data civil atual.'
      });
    }

    return {
      input,
      guardian,
      attachment,
      validFrom,
      validUntil
    };
  }

  private isAuthorizationValid(
    authorization: {
      readonly status: GuardianAuthorizationStatus;
      readonly validFrom: Date;
      readonly validUntil: Date;
      readonly privateAttachment: {
        readonly status: PrivateAttachmentStatus;
        readonly removedAt: Date | null;
      };
    },
    referenceDate = todayCivilDate()
  ): boolean {
    return (
      authorization.status === GuardianAuthorizationStatus.VALID &&
      authorization.validFrom <= referenceDate &&
      authorization.validUntil >= referenceDate &&
      authorization.privateAttachment.status === PrivateAttachmentStatus.AVAILABLE &&
      authorization.privateAttachment.removedAt === null
    );
  }

  private evaluateStoredProtection(athlete: AthleteWithRelations) {
    const today = todayCivilDate();
    const currentGuardianIds = new Set(
      athlete.guardians
        .filter((link) => link.startsOn <= today && (link.endsOn === null || link.endsOn >= today))
        .map(({ guardianId }) => guardianId)
    );
    const hasValidAuthorization = athlete.guardianAuthorizations.some(
      (authorization) =>
        currentGuardianIds.has(authorization.guardianId) &&
        this.isAuthorizationValid(authorization, today)
    );

    return evaluateAthleteProtection({
      birthDate: civilDateFromDate(athlete.birthDate),
      referenceDate: civilDateFromDate(today),
      hasGuardianLink: currentGuardianIds.size > 0,
      hasValidGuardianAuthorization: hasValidAuthorization
    });
  }

  private async ensureCategoriesExist(categoryIds: readonly string[]): Promise<void> {
    const count = await this.prisma.category.count({
      where: {
        id: { in: [...categoryIds] },
        deletedAt: null,
        isActive: true
      }
    });

    if (count !== categoryIds.length) {
      throw this.notFound(
        'SPORT_CATEGORY_NOT_FOUND',
        'Uma ou mais categorias não foram encontradas ou estão inativas.'
      );
    }
  }

  private async resolveTeamCategory(input: {
    readonly teamCategoryId?: string;
    readonly teamId?: string;
    readonly categoryId?: string;
  }) {
    if (input.teamCategoryId) {
      return this.findTeamCategory(input.teamCategoryId);
    }

    if (!input.teamId || !input.categoryId) {
      throw new BadRequestException({
        code: 'TEAM_CATEGORY_REQUIRED',
        message: 'Informe teamCategoryId ou o par teamId/categoryId.'
      });
    }

    const today = todayCivilDate();
    const link = await this.prisma.teamCategory.findFirst({
      where: {
        teamId: input.teamId,
        categoryId: input.categoryId,
        deletedAt: null,
        startsOn: { lte: today },
        OR: [{ endsOn: null }, { endsOn: { gte: today } }],
        team: {
          deletedAt: null,
          isActive: true
        },
        category: {
          deletedAt: null,
          isActive: true
        }
      },
      orderBy: [{ startsOn: 'desc' }, { id: 'desc' }]
    });

    if (!link) {
      throw this.notFound(
        'TEAM_CATEGORY_NOT_FOUND',
        'O vínculo vigente entre equipe e categoria não foi encontrado.'
      );
    }

    return link;
  }

  private async findCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });

    if (!category || category.deletedAt) {
      throw this.notFound('SPORT_CATEGORY_NOT_FOUND', 'Categoria esportiva não encontrada.');
    }

    return category;
  }

  private async findTeamEntity(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    if (!team || team.deletedAt) {
      throw this.notFound('TEAM_NOT_FOUND', 'Equipe não encontrada.');
    }

    return team;
  }

  private async findTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: teamRelations
    });

    if (!team || team.deletedAt) {
      throw this.notFound('TEAM_NOT_FOUND', 'Equipe não encontrada.');
    }

    return this.mapTeam(team);
  }

  private async findTeamCategory(teamCategoryId: string) {
    const link = await this.prisma.teamCategory.findUnique({
      where: { id: teamCategoryId },
      include: {
        category: true,
        team: true
      }
    });

    if (
      !link ||
      link.deletedAt ||
      link.team.deletedAt ||
      link.category.deletedAt ||
      !link.team.isActive ||
      !link.category.isActive
    ) {
      throw this.notFound(
        'TEAM_CATEGORY_NOT_FOUND',
        'Vínculo de equipe e categoria não encontrado.'
      );
    }

    return link;
  }

  private async findAthlete(athleteId: string): Promise<AthleteWithRelations> {
    const athlete = await this.prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      include: athleteRelations
    });

    if (!athlete || athlete.deletedAt) {
      throw this.notFound('ATHLETE_NOT_FOUND', 'Atleta não encontrado.');
    }

    return athlete;
  }

  private async getMappedAthlete(athleteId: string) {
    const athlete = await this.findAthlete(athleteId);
    const duplicateCount = await this.prisma.athleteProfile.count({
      where: {
        duplicateFingerprintHash: athlete.duplicateFingerprintHash,
        deletedAt: null
      }
    });

    return this.mapAthlete(athlete, duplicateCount > 1);
  }

  private async findGuardian(guardianId: string) {
    const guardian = await this.prisma.guardian.findUnique({ where: { id: guardianId } });

    if (!guardian || guardian.deletedAt) {
      throw this.notFound('GUARDIAN_NOT_FOUND', 'Responsável não encontrado.');
    }

    return guardian;
  }

  private async findTryoutEntity(tryoutId: string) {
    const tryout = await this.prisma.tryout.findUnique({ where: { id: tryoutId } });

    if (!tryout || tryout.deletedAt) {
      throw this.notFound('TRYOUT_NOT_FOUND', 'Seletiva não encontrada.');
    }

    return tryout;
  }

  private async findTryout(tryoutId: string) {
    const tryout = await this.prisma.tryout.findUnique({
      where: { id: tryoutId },
      include: tryoutRelations
    });

    if (!tryout || tryout.deletedAt) {
      throw this.notFound('TRYOUT_NOT_FOUND', 'Seletiva não encontrada.');
    }

    return this.mapTryout(tryout);
  }

  private async getMappedRegistration(registrationId: string) {
    const registration = await this.prisma.tryoutRegistration.findUnique({
      where: { id: registrationId },
      include: registrationRelations
    });

    if (!registration || registration.deletedAt) {
      throw this.notFound('TRYOUT_REGISTRATION_NOT_FOUND', 'Inscrição não encontrada.');
    }

    const [registrationDuplicates, athleteDuplicates] = await Promise.all([
      this.prisma.tryoutRegistration.count({
        where: {
          duplicateFingerprintHash: registration.duplicateFingerprintHash,
          deletedAt: null
        }
      }),
      this.prisma.athleteProfile.count({
        where: {
          duplicateFingerprintHash: registration.duplicateFingerprintHash,
          deletedAt: null
        }
      })
    ]);

    return this.mapRegistration(registration, registrationDuplicates > 1 || athleteDuplicates > 0);
  }

  private async findDuplicateCounts(
    hashes: readonly string[],
    model: 'athlete' | 'registration'
  ): Promise<ReadonlyMap<string, number>> {
    const uniqueHashes = [...new Set(hashes)];

    if (uniqueHashes.length === 0) {
      return new Map();
    }

    if (model === 'athlete') {
      const groups = await this.prisma.athleteProfile.groupBy({
        by: ['duplicateFingerprintHash'],
        where: {
          duplicateFingerprintHash: { in: uniqueHashes },
          deletedAt: null
        },
        _count: { _all: true }
      });

      return new Map(groups.map((group) => [group.duplicateFingerprintHash, group._count._all]));
    }

    const groups = await this.prisma.tryoutRegistration.groupBy({
      by: ['duplicateFingerprintHash'],
      where: {
        duplicateFingerprintHash: { in: uniqueHashes },
        deletedAt: null
      },
      _count: { _all: true }
    });

    return new Map(groups.map((group) => [group.duplicateFingerprintHash, group._count._all]));
  }

  private mapTeam(team: TeamWithRelations) {
    const today = todayCivilDate();
    const currentLinks = team.categories.filter(
      (link) =>
        !link.deletedAt &&
        link.startsOn <= today &&
        (link.endsOn === null || link.endsOn >= today) &&
        !link.category.deletedAt
    );
    const categories = [
      ...new Map(
        currentLinks.map(({ category }) => [category.id, { id: category.id, name: category.name }])
      ).values()
    ];
    const currentAthleteIds = new Set(
      currentLinks.flatMap(({ affiliations }) =>
        affiliations
          .filter(
            (affiliation) =>
              affiliation.startsOn <= today &&
              (affiliation.endsOn === null || affiliation.endsOn >= today)
          )
          .map(({ athleteProfileId }) => athleteProfileId)
      )
    );

    return {
      id: team.id,
      code: team.code,
      name: team.name,
      slug: team.slug,
      description: team.description,
      isActive: team.isActive,
      categories,
      athletesCount: currentAthleteIds.size
    };
  }

  private mapAthlete(athlete: AthleteWithRelations, duplicateWarning: boolean) {
    const today = todayCivilDate();
    const isMinor = this.isMinor(civilDateFromDate(athlete.birthDate));
    const currentAffiliation = athlete.affiliations.find(
      (affiliation) =>
        affiliation.startsOn <= today &&
        (affiliation.endsOn === null || affiliation.endsOn >= today) &&
        !affiliation.teamCategory.deletedAt &&
        !affiliation.teamCategory.team.deletedAt &&
        !affiliation.teamCategory.category.deletedAt
    );
    const protection = this.evaluateStoredProtection(athlete);

    return {
      id: athlete.id,
      userId: athlete.userId,
      fullName: athlete.fullName,
      preferredName: athlete.preferredName,
      birthDate: civilDateFromDate(athlete.birthDate),
      position: athlete.position,
      status: athlete.status,
      isFictitious: athlete.isFictitious,
      isMinor,
      duplicateWarning,
      guardianAuthorizationValid: isMinor ? protection.allowed : null,
      currentMembership: currentAffiliation
        ? {
            id: currentAffiliation.id,
            team: {
              id: currentAffiliation.teamCategory.team.id,
              name: currentAffiliation.teamCategory.team.name
            },
            category: {
              id: currentAffiliation.teamCategory.category.id,
              name: currentAffiliation.teamCategory.category.name
            },
            startsOn: civilDateFromDate(currentAffiliation.startsOn),
            endsOn: currentAffiliation.endsOn ? civilDateFromDate(currentAffiliation.endsOn) : null,
            isCurrent: true
          }
        : null
    };
  }

  private mapGuardian(guardian: GuardianWithRelations) {
    const today = todayCivilDate();
    const activeLinks = guardian.athleteLinks.filter(
      (link) =>
        link.startsOn <= today &&
        (link.endsOn === null || link.endsOn >= today) &&
        !link.athleteProfile.deletedAt
    );

    return {
      id: guardian.id,
      fullName: guardian.fullName,
      email: guardian.email,
      phone: guardian.phone,
      isFictitious: guardian.isFictitious,
      athletes: activeLinks.map((link) => {
        const authorization = link.athleteProfile.guardianAuthorizations
          .filter(
            (item) =>
              item.guardianId === guardian.id &&
              item.status === GuardianAuthorizationStatus.VALID &&
              item.validFrom <= today &&
              item.validUntil >= today
          )
          .sort((left, right) => right.validUntil.getTime() - left.validUntil.getTime())[0];

        return {
          athleteId: link.athleteProfile.id,
          athleteName: link.athleteProfile.fullName,
          authorizationValidUntil: authorization
            ? civilDateFromDate(authorization.validUntil)
            : null
        };
      })
    };
  }

  private mapTryout(tryout: TryoutWithRelations) {
    const waitlistCount = tryout.registrations.filter(
      ({ status }) => status === TryoutRegistrationStatus.WAITLISTED
    ).length;

    return {
      id: tryout.id,
      title: tryout.title,
      slug: tryout.slug,
      description: tryout.description,
      status: tryout.status,
      startsAt: tryout.startsAt.toISOString(),
      registrationStartsAt: tryout.registrationStartsAt.toISOString(),
      registrationEndsAt: tryout.registrationEndsAt.toISOString(),
      location: tryout.location,
      capacity: tryout.capacity,
      waitlistCapacity: tryout.waitlistCapacity,
      registrationsCount: tryout.registrations.length,
      waitlistCount,
      team: {
        id: tryout.teamCategory.team.id,
        name: tryout.teamCategory.team.name
      },
      category: {
        id: tryout.teamCategory.category.id,
        name: tryout.teamCategory.category.name
      }
    };
  }

  private mapRegistration(registration: RegistrationWithRelations, duplicateWarning: boolean) {
    const isMinor = this.isMinor(civilDateFromDate(registration.birthDate));
    const authorizationValid = registration.guardianAuthorizations.some((authorization) =>
      this.isAuthorizationValid(authorization)
    );
    const attendanceStatus =
      registration.status === TryoutRegistrationStatus.ATTENDED
        ? 'PRESENT'
        : registration.status === TryoutRegistrationStatus.NO_SHOW
          ? 'ABSENT'
          : null;
    const result =
      registration.status === TryoutRegistrationStatus.APPROVED ||
      registration.status === TryoutRegistrationStatus.CONVERTED
        ? 'APPROVED'
        : registration.status === TryoutRegistrationStatus.REJECTED
          ? 'REJECTED'
          : registration.status === TryoutRegistrationStatus.WAITLISTED
            ? 'WAITLISTED'
            : null;

    return {
      id: registration.id,
      fullName: registration.fullName,
      birthDate: civilDateFromDate(registration.birthDate),
      status: registration.status,
      attendanceStatus,
      result,
      isMinor,
      guardianAuthorizationValid: isMinor ? authorizationValid : null,
      duplicateWarning,
      convertedAthleteId: registration.convertedAthleteProfileId,
      createdAt: registration.createdAt.toISOString(),
      tryout: {
        id: registration.tryout.id,
        title: registration.tryout.title
      }
    };
  }

  private async withSerializableRetry<T>(
    operation: (database: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        if (!isSerializableConflict(error)) {
          throw error;
        }

        if (attempt === MAX_SERIALIZABLE_ATTEMPTS) {
          throw new ConflictException({
            code: 'SPORT_CONCURRENCY_CONFLICT',
            message: 'A operação concorrente não pôde ser concluída com segurança.'
          });
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, attempt * 10);
        });
      }
    }

    throw new ConflictException({
      code: 'SPORT_CONCURRENCY_CONFLICT',
      message: 'A operação concorrente não pôde ser concluída com segurança.'
    });
  }

  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }
}
