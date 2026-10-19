import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Paginação por offset com limite defensivo (DT-025). */
export class PageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly meta: PageMeta;
}

export function pageArgs(query: PageQueryDto): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function toPage<T>(
  data: readonly T[],
  total: number,
  page: number,
  pageSize: number
): Page<T> {
  return { data, meta: { page, pageSize, total } };
}
