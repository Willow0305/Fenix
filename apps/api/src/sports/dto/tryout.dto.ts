import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

import { GuardianAuthorizationMetadataDto } from './guardian.dto';

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TRYOUT_STATUSES = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED'] as const;
const REGISTRATION_STATUSES = [
  'NEW',
  'UNDER_REVIEW',
  'WAITLISTED',
  'APPROVED',
  'REJECTED',
  'ATTENDED',
  'NO_SHOW',
  'CONVERTED',
  'CANCELLED'
] as const;

export class CreateTryoutDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly teamCategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly teamId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly categoryId?: string;

  @ApiProperty({ example: 'Seletiva fictícia 2026' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  public readonly title!: string;

  @ApiPropertyOptional({ example: 'seletiva-ficticia-2026' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(160)
  public readonly slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  public readonly description?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  public readonly location!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  public readonly startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  public readonly registrationStartsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  public readonly registrationEndsAt!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  public readonly capacity!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  public readonly waitlistCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  public readonly criteria?: string;

  @ApiPropertyOptional({ enum: TRYOUT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsIn(TRYOUT_STATUSES)
  public readonly status?: (typeof TRYOUT_STATUSES)[number];
}

export class UpdateTryoutDto extends PartialType(CreateTryoutDto) {}

export class CreateTryoutRegistrationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly tryoutId!: string;

  @ApiProperty({ example: 'Candidato Fictício' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  public readonly fullName!: string;

  @ApiProperty({ example: '2001-04-09' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly birthDate!: string;

  @ApiPropertyOptional({ example: 'candidato@example.test' })
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  public readonly email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  public readonly phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public readonly desiredPosition?: string;

  @ApiProperty({ example: true })
  @Equals(true)
  public readonly isFictitious!: true;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianAuthorizationMetadataDto)
  public readonly guardianAuthorization?: GuardianAuthorizationMetadataDto;
}

export class UpdateTryoutRegistrationStatusDto {
  @ApiProperty({ enum: REGISTRATION_STATUSES })
  @IsIn(REGISTRATION_STATUSES)
  public readonly status!: (typeof REGISTRATION_STATUSES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  public readonly reason!: string;
}

export class ConvertTryoutRegistrationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly teamCategoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly teamId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly categoryId?: string;

  @ApiPropertyOptional({ example: '2026-07-27' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN)
  public readonly affiliationStartsOn?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  public readonly reason!: string;
}
