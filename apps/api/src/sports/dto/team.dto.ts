import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class CreateTeamDto {
  @ApiProperty({ example: 'Fênix Desenvolvimento' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public readonly name!: string;

  @ApiPropertyOptional({ example: 'fenix-desenvolvimento' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(120)
  public readonly slug?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  public readonly categoryIds?: readonly string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public readonly description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  public readonly isActive?: boolean;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

export class LinkTeamCategoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly categoryId!: string;

  @ApiProperty({ example: '2026-07-27' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly startsOn!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN)
  public readonly endsOn?: string;
}
