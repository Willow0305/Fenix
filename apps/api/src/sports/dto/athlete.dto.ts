import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Equals,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

import { GuardianAuthorizationMetadataDto } from './guardian.dto';

const ATHLETE_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class CreateAthleteDto {
  @ApiProperty({ example: 'Atleta Fictício' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  public readonly fullName!: string;

  @ApiPropertyOptional({ example: 'Atleta' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly preferredName?: string;

  @ApiProperty({ example: '2001-04-09' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly birthDate!: string;

  @ApiPropertyOptional({ example: 'PONTEIRO' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public readonly position?: string;

  @ApiPropertyOptional({ enum: ATHLETE_STATUSES, default: 'PENDING' })
  @IsOptional()
  @IsIn(ATHLETE_STATUSES)
  public readonly status?: (typeof ATHLETE_STATUSES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  public readonly userId?: string;

  @ApiProperty({
    description: 'A primeira entrega aceita somente registros explicitamente fictícios.',
    example: true
  })
  @Equals(true)
  public readonly isFictitious!: true;

  @ApiPropertyOptional({
    description: 'Metadados protegidos exigidos na criação atômica de atleta fictício menor.'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianAuthorizationMetadataDto)
  public readonly guardianAuthorization?: GuardianAuthorizationMetadataDto;
}

export class UpdateAthleteDto extends PartialType(CreateAthleteDto) {}

export class CreateAthleteAffiliationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  public readonly teamCategoryId!: string;

  @ApiProperty({ example: '2026-07-27' })
  @Matches(CIVIL_DATE_PATTERN)
  public readonly startsOn!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN)
  public readonly endsOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public readonly reason?: string;
}
