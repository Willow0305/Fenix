import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentPrincipal, type Principal } from '../../common/http/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS, type PermissionCode } from '../access/domain/permission-catalog';
import { RequirePermissions } from '../auth/http/auth.decorators';

export interface SearchHit {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly link: string;
}

export interface SearchGroup {
  readonly key: string;
  readonly label: string;
  readonly hits: SearchHit[];
}

const PER_GROUP = 5;

/** Padrão do LIKE com os curingas do usuário escapados (`%`, `_`, `\`). */
export function likePattern(query: string): string {
  return `%${query
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

interface Row {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
}

/**
 * Busca global do painel (DT-057): nome, número ou título em vários módulos de uma vez,
 * sem diferenciar maiúsculas nem acentos. Cada grupo só aparece para quem tem a permissão
 * daquele módulo; nada de documento, telefone ou e-mail de terceiros no resultado.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(principal: Principal, query: string): Promise<SearchGroup[]> {
    const pattern = likePattern(query);
    const can = (permission: PermissionCode) => principal.permissions.has(permission);
    const groups: { key: string; label: string; run: () => Promise<SearchHit[]> }[] = [];
    const hits = (rows: Row[], link: (id: string) => string): SearchHit[] =>
      rows.map((row) => ({ ...row, link: link(row.id) }));

    if (can(PERMISSIONS.athletesRead)) {
      groups.push({
        key: 'athletes',
        label: 'Atletas',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, full_name AS title,
                CASE status WHEN 'ACTIVE' THEN 'Ativo' WHEN 'PENDING' THEN 'Pendente'
                  WHEN 'SUSPENDED' THEN 'Suspenso' ELSE 'Inativo' END AS subtitle
              FROM athletes
              WHERE deleted_at IS NULL
                AND (unaccent(lower(full_name)) LIKE unaccent(${pattern})
                  OR unaccent(lower(coalesce(preferred_name, ''))) LIKE unaccent(${pattern}))
              ORDER BY full_name LIMIT ${PER_GROUP}`,
            (id) => `/admin/atletas/${id}`
          )
      });
    }

    if (can(PERMISSIONS.ordersRead)) {
      groups.push({
        key: 'orders',
        label: 'Pedidos',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, 'Pedido ' || order_number AS title, customer_name AS subtitle
              FROM orders
              WHERE lower(order_number) LIKE ${pattern}
                 OR unaccent(lower(customer_name)) LIKE unaccent(${pattern})
              ORDER BY created_at DESC LIMIT ${PER_GROUP}`,
            (id) => `/admin/pedidos/${id}`
          )
      });
    }

    if (can(PERMISSIONS.productsManage)) {
      groups.push({
        key: 'products',
        label: 'Produtos',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT p.id, p.name AS title, NULL::text AS subtitle
              FROM products p
              WHERE p.deleted_at IS NULL
                AND (unaccent(lower(p.name)) LIKE unaccent(${pattern})
                  OR EXISTS (SELECT 1 FROM product_variants v
                    WHERE v.product_id = p.id AND v.deleted_at IS NULL
                      AND lower(v.sku) LIKE ${pattern}))
              ORDER BY p.name LIMIT ${PER_GROUP}`,
            (id) => `/admin/produtos/${id}`
          )
      });
    }

    if (can(PERMISSIONS.partnersManage)) {
      groups.push({
        key: 'partners',
        label: 'Parceiros',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, display_name AS title, legal_name AS subtitle
              FROM partners
              WHERE deleted_at IS NULL
                AND (unaccent(lower(display_name)) LIKE unaccent(${pattern})
                  OR unaccent(lower(legal_name)) LIKE unaccent(${pattern}))
              ORDER BY display_name LIMIT ${PER_GROUP}`,
            (id) => `/admin/parceiros/${id}`
          )
      });
    }

    if (can(PERMISSIONS.usersRead)) {
      groups.push({
        key: 'users',
        label: 'Usuários',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, name AS title, NULL::text AS subtitle
              FROM users
              WHERE deleted_at IS NULL
                AND (unaccent(lower(name)) LIKE unaccent(${pattern}) OR lower(email) LIKE ${pattern})
              ORDER BY name LIMIT ${PER_GROUP}`,
            () => `/admin/usuarios?busca=${encodeURIComponent(query.trim())}`
          )
      });
    }

    if (can(PERMISSIONS.registrationsRead)) {
      groups.push({
        key: 'interested',
        label: 'Interessados',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, full_name AS title, NULL::text AS subtitle
              FROM interested_people
              WHERE deleted_at IS NULL AND unaccent(lower(full_name)) LIKE unaccent(${pattern})
              ORDER BY created_at DESC LIMIT ${PER_GROUP}`,
            () => `/admin/interessados?busca=${encodeURIComponent(query.trim())}`
          )
      });
      groups.push({
        key: 'tryouts',
        label: 'Seletivas',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, title, NULL::text AS subtitle
              FROM tryouts
              WHERE deleted_at IS NULL AND unaccent(lower(title)) LIKE unaccent(${pattern})
              ORDER BY created_at DESC LIMIT ${PER_GROUP}`,
            (id) => `/admin/seletivas/${id}`
          )
      });
    }

    if (can(PERMISSIONS.newsManage)) {
      groups.push({
        key: 'news',
        label: 'Notícias',
        run: async () =>
          hits(
            await this.prisma.$queryRaw<Row[]>`
              SELECT id, title, NULL::text AS subtitle
              FROM news
              WHERE deleted_at IS NULL AND unaccent(lower(title)) LIKE unaccent(${pattern})
              ORDER BY created_at DESC LIMIT ${PER_GROUP}`,
            (id) => `/admin/noticias/${id}`
          )
      });
    }

    const results = await Promise.all(
      groups.map(async (group) => ({ key: group.key, label: group.label, hits: await group.run() }))
    );

    return results.filter((group) => group.hits.length > 0);
  }
}

export class SearchQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'Digite pelo menos 2 letras.' })
  @MaxLength(80)
  q!: string;
}

@ApiTags('Busca')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.dashboardRead)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(
    @CurrentPrincipal() principal: Principal,
    @Query() query: SearchQueryDto
  ): Promise<SearchGroup[]> {
    return this.searchService.search(principal, query.q);
  }
}

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
