import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AthleteStatus,
  Gender,
  InterestedPersonStatus,
  TeamType,
  TryoutRegistrationStatus,
  TryoutStatus
} from '../../../generated/prisma/client';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { IsCpf, IsMobilePhoneBr, IsPhoneBr } from '../../../common/validation/br-fields';
import { PageQueryDto } from '../../../common/http/pagination';

export const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class OptionalReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RequiredReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class SportCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) minimumAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) maximumAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) minimumAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) maximumAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TeamDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ enum: TeamType }) @IsEnum(TeamType) type!: TeamType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateTeamDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ enum: TeamType }) @IsOptional() @IsEnum(TeamType) type?: TeamType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AthleteDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) fullName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) preferredName?: string;
  @ApiPropertyOptional({ example: '2008-05-20' })
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: 'Data inválida (AAAA-MM-DD).' })
  birthDate?: string;
  @ApiPropertyOptional({ description: 'Armazenado cifrado; usado para evitar duplicidade.' })
  @IsOptional()
  @IsCpf()
  documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsMobilePhoneBr()
  phone?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) position?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) emergencyContactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneBr()
  emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) guardianName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsMobilePhoneBr()
  guardianPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() guardianAcknowledged?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class UpdateAthleteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(160) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) preferredName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(CIVIL_DATE_PATTERN, { message: 'Data inválida (AAAA-MM-DD).' })
  birthDate?: string;
  @ApiPropertyOptional({ description: 'CPF; string vazia remove.' })
  @IsOptional()
  @IsCpf({ allowEmpty: true })
  documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsMobilePhoneBr()
  phone?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) position?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) emergencyContactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneBr()
  emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) guardianName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsMobilePhoneBr()
  guardianPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() guardianAcknowledged?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class AthleteListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: AthleteStatus })
  @IsOptional()
  @IsEnum(AthleteStatus)
  status?: AthleteStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
}

export class AthleteStatusDto extends RequiredReasonDto {
  @ApiProperty({ enum: AthleteStatus }) @IsEnum(AthleteStatus) status!: AthleteStatus;
  @ApiPropertyOptional({
    description: 'Ao inativar/suspender: cancela mensalidades futuras sem pagamento.'
  })
  @IsOptional()
  @IsBoolean()
  cancelFutureFees?: boolean;
  @ApiPropertyOptional({ description: 'Ao inativar/suspender: encerra o plano de mensalidade.' })
  @IsOptional()
  @IsBoolean()
  endPlan?: boolean;
  @ApiPropertyOptional({ description: 'Ao inativar: encerra os vínculos com equipes.' })
  @IsOptional()
  @IsBoolean()
  endMemberships?: boolean;
}

export class LinkUserDto {
  @ApiProperty() @IsEmail() @MaxLength(180) email!: string;
}

export class MembershipDto {
  @ApiProperty() @IsUUID() teamId!: string;
  @ApiProperty({ example: '2026-01-15' })
  @Matches(CIVIL_DATE_PATTERN, { message: 'Data inválida (AAAA-MM-DD).' })
  startsOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) position?: string;
}

export class EndMembershipDto extends RequiredReasonDto {
  @ApiProperty()
  @Matches(CIVIL_DATE_PATTERN, { message: 'Data inválida (AAAA-MM-DD).' })
  endsOn!: string;
}

export class ApplicantDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) fullName!: string;
  @ApiProperty({ example: '2008-05-20' })
  @Matches(CIVIL_DATE_PATTERN, { message: 'Data inválida (AAAA-MM-DD).' })
  birthDate!: string;
  @ApiProperty() @IsEmail() @MaxLength(180) email!: string;
  @ApiProperty() @IsMobilePhoneBr() phone!: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) desiredPosition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) experience?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) guardianName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsMobilePhoneBr({ allowEmpty: true })
  guardianPhone?: string;

  @ApiProperty({ description: 'Ciência do aviso de privacidade.' })
  @IsBoolean()
  @Equals(true, { message: 'É necessário concordar com o aviso de privacidade.' })
  privacyConsent!: boolean;
}

export class InterestDto extends ApplicantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class InterestedQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: InterestedPersonStatus })
  @IsOptional()
  @IsEnum(InterestedPersonStatus)
  status?: InterestedPersonStatus;
}

export class InterestedStatusDto extends OptionalReasonDto {
  @ApiProperty({ enum: InterestedPersonStatus })
  @IsEnum(InterestedPersonStatus)
  status!: InterestedPersonStatus;
}

export class TryoutDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(220) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() registrationStartsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() registrationEndsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10000) maxSlots?: number;
}

export class UpdateTryoutDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(160) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(220) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() registrationStartsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() registrationEndsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10000) maxSlots?: number;
}

export class TryoutStatusDto extends OptionalReasonDto {
  @ApiProperty({ enum: TryoutStatus }) @IsEnum(TryoutStatus) status!: TryoutStatus;
}

export class RegistrationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: TryoutRegistrationStatus })
  @IsOptional()
  @IsEnum(TryoutRegistrationStatus)
  status?: TryoutRegistrationStatus;
}

export class RegistrationReviewDto extends OptionalReasonDto {
  @ApiProperty({ enum: TryoutRegistrationStatus })
  @IsEnum(TryoutRegistrationStatus)
  status!: TryoutRegistrationStatus;
}

export class TeamQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

export class RosterQueryDto {
  @ApiPropertyOptional({ enum: TeamType }) @IsOptional() @IsEnum(TeamType) type?: TeamType;
}

/** Autorização do responsável para menor aparecer no elenco público (DT-044). */
export class PublicProfileConsentDto extends RequiredReasonDto {
  @ApiProperty() @IsBoolean() granted!: boolean;
}
