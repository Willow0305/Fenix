import { Injectable } from '@nestjs/common';
import type { TeamType } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { slugify } from '../domain/sports-rules';
import { softDeleteIfUnused } from '../../../common/domain/safe-delete';
import { ageOn, civilToDate, dateToCivil, todayIn } from '../../../common/domain/civil-date';
import { ADULT_AGE } from '../domain/sports-rules';
import { mediaUrl } from '../../media/application/media.service';

export interface CategoryView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly minimumAge: number | null;
  readonly maximumAge: number | null;
  readonly isActive: boolean;
}

export interface TeamView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: TeamType;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly category: { id: string; name: string } | null;
  readonly activeAthletes?: number;
}

export interface CategoryInput {
  readonly name: string;
  readonly description?: string | null;
  readonly minimumAge?: number | null;
  readonly maximumAge?: number | null;
  readonly isActive?: boolean;
}

export interface TeamInput {
  readonly name: string;
  readonly type: TeamType;
  readonly description?: string | null;
  readonly categoryId?: string | null;
  readonly isActive?: boolean;
}

/** Equipes (elenco) e categorias (classificação esportiva) — PEN-015, RF-002. */
export interface RosterAthleteView {
  readonly displayName: string;
  readonly position: string | null;
  /** Só existe se a pessoa escolheu perfil público (arquivo classificado como PUBLIC). */
  readonly photoUrl: string | null;
}

export interface RosterCategoryView {
  readonly category: { id: string; name: string } | null;
  readonly teams: {
    id: string;
    name: string;
    slug: string;
    type: TeamType;
    description: string | null;
    athletes: RosterAthleteView[];
  }[];
}

/** Soma anos a uma data civil (29/02 vira 28/02 em ano não bissexto). */
function addYears(civil: string, years: number): string {
  const [y, m, d] = civil.split('-').map(Number) as [number, number, number];
  const year = y + years;
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();

  return `${year}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Apelido ou nome e último sobrenome; para menor, sobrenome só com a inicial. */
export function publicDisplayName(
  fullName: string,
  preferredName: string | null,
  adult: boolean
): string {
  if (preferredName?.trim()) {
    return preferredName.trim();
  }

  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';

  if (!last) {
    return first;
  }

  return adult ? `${first} ${last}` : `${first} ${last.charAt(0)}.`;
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async categories(includeInactive: boolean): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' }
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      minimumAge: row.minimumAge,
      maximumAge: row.maximumAge,
      isActive: row.isActive
    }));
  }

  private assertAges(input: Partial<CategoryInput>): void {
    if (
      input.minimumAge !== undefined &&
      input.minimumAge !== null &&
      input.maximumAge !== undefined &&
      input.maximumAge !== null &&
      input.minimumAge > input.maximumAge
    ) {
      throw AppError.validation(
        'INVALID_AGE_RANGE',
        'A idade mínima não pode ser maior que a máxima.'
      );
    }
  }

  async createCategory(
    actor: Principal,
    input: CategoryInput,
    meta: RequestMeta
  ): Promise<CategoryView> {
    this.assertAges(input);
    const created = await this.prisma.category.create({
      data: {
        name: input.name.trim(),
        slug: await this.uniqueSlug('category', input.name),
        description: input.description ?? null,
        minimumAge: input.minimumAge ?? null,
        maximumAge: input.maximumAge ?? null,
        isActive: input.isActive ?? true
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'category.created',
      entityType: 'Category',
      entityId: created.id,
      after: { name: created.name },
      meta
    });

    return (await this.categories(true)).find((c) => c.id === created.id) as CategoryView;
  }

  async updateCategory(
    actor: Principal,
    id: string,
    input: Partial<CategoryInput>,
    meta: RequestMeta
  ): Promise<CategoryView> {
    const before = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Categoria não encontrada.');
    }

    this.assertAges({
      minimumAge: input.minimumAge === undefined ? before.minimumAge : input.minimumAge,
      maximumAge: input.maximumAge === undefined ? before.maximumAge : input.maximumAge
    });
    await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.minimumAge === undefined ? {} : { minimumAge: input.minimumAge }),
        ...(input.maximumAge === undefined ? {} : { maximumAge: input.maximumAge }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'category.updated',
      entityType: 'Category',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: input as Record<string, unknown>,
      meta
    });

    return (await this.categories(true)).find((c) => c.id === id) as CategoryView;
  }

  /**
   * Elenco público por categoria (PEN-062, DT-044). Só atletas ativos, com vínculo aberto
   * em equipe ativa, que marcaram perfil público na própria conta; menor de 18 (ou sem
   * nascimento) só com autorização do responsável. Expõe apenas nome de exibição, posição
   * e foto pública: nunca idade, contato ou documento.
   */
  async publicRoster(type?: TeamType): Promise<RosterCategoryView[]> {
    const today = todayIn();
    const adultBirth = civilToDate(addYears(today, -ADULT_AGE));
    const teams = await this.prisma.team.findMany({
      where: { deletedAt: null, isActive: true, ...(type ? { type } : {}) },
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true, minimumAge: true } },
        memberships: {
          where: {
            status: 'ACTIVE',
            endsOn: null,
            athlete: {
              deletedAt: null,
              status: 'ACTIVE',
              user: { profilePublic: true, status: 'ACTIVE', deletedAt: null },
              OR: [{ birthDate: { lte: adultBirth } }, { publicProfileConsentAt: { not: null } }]
            }
          },
          include: {
            athlete: {
              select: {
                fullName: true,
                preferredName: true,
                birthDate: true,
                position: true,
                user: { select: { avatarMediaFileId: true } }
              }
            }
          }
        }
      }
    });
    const groups = new Map<string, RosterCategoryView>();

    for (const team of teams) {
      const key = team.category?.id ?? 'sem-categoria';
      const group = groups.get(key) ?? {
        category: team.category ? { id: team.category.id, name: team.category.name } : null,
        teams: []
      };

      group.teams.push({
        id: team.id,
        name: team.name,
        slug: team.slug,
        type: team.type,
        description: team.description,
        athletes: team.memberships
          .map((membership) => {
            const athlete = membership.athlete;
            const adult =
              athlete.birthDate !== null &&
              ageOn(dateToCivil(athlete.birthDate), today) >= ADULT_AGE;

            return {
              displayName: publicDisplayName(athlete.fullName, athlete.preferredName, adult),
              position: membership.position ?? athlete.position,
              photoUrl: athlete.user?.avatarMediaFileId
                ? mediaUrl(athlete.user.avatarMediaFileId)
                : null
            };
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))
      });
      groups.set(key, group);
    }

    // Categorias em ordem de nome; equipes sem categoria por último.
    return [...groups.values()].sort((a, b) =>
      a.category === null
        ? 1
        : b.category === null
          ? -1
          : a.category.name.localeCompare(b.category.name, 'pt-BR')
    );
  }

  async teams(options: { includeInactive: boolean; withCounts: boolean }): Promise<TeamView[]> {
    const rows = await this.prisma.team.findMany({
      where: { deletedAt: null, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        ...(options.withCounts
          ? { _count: { select: { memberships: { where: { status: 'ACTIVE', endsOn: null } } } } }
          : {})
      }
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      description: row.description,
      isActive: row.isActive,
      category: row.category,
      ...('_count' in row
        ? { activeAthletes: (row._count as { memberships: number }).memberships }
        : {})
    }));
  }

  async teamBySlug(slug: string): Promise<TeamView> {
    const team = (await this.teams({ includeInactive: false, withCounts: false })).find(
      (t) => t.slug === slug
    );

    if (team === undefined) {
      throw AppError.notFound('Equipe não encontrada.');
    }

    return team;
  }

  private async uniqueSlug(kind: 'team' | 'category', name: string): Promise<string> {
    const base = slugify(name) || kind;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const exists =
        kind === 'team'
          ? await this.prisma.team.findUnique({ where: { slug: candidate }, select: { id: true } })
          : await this.prisma.category.findUnique({
              where: { slug: candidate },
              select: { id: true }
            });

      if (exists === null) {
        return candidate;
      }
    }

    throw AppError.conflict('SLUG_UNAVAILABLE', 'Não foi possível gerar um identificador único.');
  }

  private async assertCategory(categoryId: string | null | undefined): Promise<void> {
    if (categoryId) {
      const exists = await this.prisma.category.findFirst({
        where: { id: categoryId, deletedAt: null }
      });

      if (exists === null) {
        throw AppError.validation('UNKNOWN_CATEGORY', 'Categoria inexistente.');
      }
    }
  }

  async createTeam(actor: Principal, input: TeamInput, meta: RequestMeta): Promise<TeamView> {
    await this.assertCategory(input.categoryId);
    const created = await this.prisma.team.create({
      data: {
        name: input.name.trim(),
        slug: await this.uniqueSlug('team', input.name),
        type: input.type,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        isActive: input.isActive ?? true
      }
    });

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.created',
      entityType: 'Team',
      entityId: created.id,
      after: { name: created.name, type: created.type },
      meta
    });

    return (await this.teams({ includeInactive: true, withCounts: true })).find(
      (t) => t.id === created.id
    ) as TeamView;
  }

  async updateTeam(
    actor: Principal,
    id: string,
    input: Partial<TeamInput>,
    meta: RequestMeta
  ): Promise<TeamView> {
    const before = await this.prisma.team.findFirst({ where: { id, deletedAt: null } });

    if (before === null) {
      throw AppError.notFound('Equipe não encontrada.');
    }

    await this.assertCategory(input.categoryId);
    await this.prisma.team.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive })
      }
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.updated',
      entityType: 'Team',
      entityId: id,
      before: {
        name: before.name,
        type: before.type,
        isActive: before.isActive,
        categoryId: before.categoryId
      },
      after: input as Record<string, unknown>,
      meta
    });

    return (await this.teams({ includeInactive: true, withCounts: true })).find(
      (t) => t.id === id
    ) as TeamView;
  }

  /** Exclusão lógica só sem uso (docs/29 COR-022); em uso, a resposta sugere inativar. */
  async deleteCategory(
    actor: Principal,
    id: string,
    reason: string,
    meta: RequestMeta
  ): Promise<void> {
    await softDeleteIfUnused({
      prisma: this.prisma,
      audit: this.audit,
      actor,
      meta,
      reason,
      entityId: id,
      entityType: 'Category',
      action: 'category.deleted',
      noun: 'a categoria',
      load: (tx) =>
        tx.category.findFirst({ where: { id, deletedAt: null }, select: { name: true } }),
      usage: async (tx) => [
        {
          count: await tx.team.count({ where: { categoryId: id, deletedAt: null } }),
          label: 'equipe(s)'
        }
      ],
      remove: (tx) =>
        tx.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    });
  }
}
