import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointmentStatus,
  CommissionType,
  PartnerSettlementStatus,
  PartnerStatus,
  PartnerType,
  ProfessionalStatus,
  ServiceStatus
} from '../../../generated/prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { IsCpfOrCnpj, IsPhoneBr } from '../../../common/validation/br-fields';
import { PageQueryDto } from '../../../common/http/pagination';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };
const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const AMOUNT_MSG = { message: 'Valor inválido: use ponto e até 2 casas (ex.: 89.90).' };
const SIGNED_AMOUNT = /^-?\d{1,13}(\.\d{1,2})?$/;
const PERCENT = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;
const PERCENT_MSG = { message: 'Percentual inválido: de 0 a 100, até 2 casas.' };

export class PartnerDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(180) legalName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) displayName!: string;
  @ApiProperty({ enum: PartnerType }) @IsEnum(PartnerType) type!: PartnerType;
  @ApiPropertyOptional({ description: 'CNPJ/CPF; armazenado cifrado.' })
  @IsOptional()
  @IsCpfOrCnpj()
  documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsPhoneBr() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(300)
  websiteUrl?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) contractStartsOn?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) contractEndsOn?: string;
  @ApiPropertyOptional({ enum: CommissionType })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;
  @ApiPropertyOptional({ example: '15' })
  @IsOptional()
  @Matches(PERCENT, PERCENT_MSG)
  commissionPercentage?: string;
  @ApiPropertyOptional({ example: '5.00' })
  @IsOptional()
  @Matches(AMOUNT, AMOUNT_MSG)
  commissionFixedAmount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) contractNotes?: string;
}

export class UpdatePartnerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(180) legalName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName?: string;
  @ApiPropertyOptional({ enum: PartnerType }) @IsOptional() @IsEnum(PartnerType) type?: PartnerType;
  @ApiPropertyOptional({ description: 'String vazia remove o documento.' })
  @IsOptional()
  @IsCpfOrCnpj({ allowEmpty: true })
  documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) contactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^([^\s@]+@[^\s@]+\.[^\s@]+)?$/, { message: 'E-mail inválido.' })
  @MaxLength(180)
  email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneBr({ allowEmpty: true })
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ description: 'String vazia remove o site.' })
  @IsOptional()
  @Matches(/^(https?:\/\/[^\s<>"]+)?$/, { message: 'Informe um endereço começando com https://.' })
  @MaxLength(300)
  websiteUrl?: string;
  @ApiPropertyOptional({ description: 'String vazia remove a data.' })
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, DATE_MSG)
  contractStartsOn?: string;
  @ApiPropertyOptional({ description: 'String vazia remove a data.' })
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, DATE_MSG)
  contractEndsOn?: string;
  @ApiPropertyOptional({ enum: CommissionType })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;
  @ApiPropertyOptional() @IsOptional() @Matches(PERCENT, PERCENT_MSG) commissionPercentage?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(AMOUNT, AMOUNT_MSG)
  commissionFixedAmount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) contractNotes?: string;
}

export class PartnerStatusDto {
  @ApiProperty({ enum: PartnerStatus }) @IsEnum(PartnerStatus) status!: PartnerStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
}

export class PartnerQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PartnerStatus })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;
  @ApiPropertyOptional({ enum: PartnerType }) @IsOptional() @IsEnum(PartnerType) type?: PartnerType;
}

export class PartnerDocumentDto {
  @ApiProperty({ example: 'Contrato' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  documentType!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) issuedOn?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) expiresOn?: string;
}

export class PartnerReasonDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class ProfessionalDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) fullName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) profession!: string;
  @ApiPropertyOptional({ description: 'Registro profissional; armazenado cifrado.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsPhoneBr() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) publicBio?: string;
  @ApiPropertyOptional({ description: 'Autoriza exibir e-mail e telefone no site.' })
  @IsOptional()
  @IsBoolean()
  publicContact?: boolean;
}

export class UpdateProfessionalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) fullName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  profession?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(180) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsPhoneBr({ allowEmpty: true }) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) publicBio?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() publicContact?: boolean;
  @ApiPropertyOptional({ enum: ProfessionalStatus })
  @IsOptional()
  @IsEnum(ProfessionalStatus)
  status?: ProfessionalStatus;
}

export class ServiceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiProperty({ minimum: 5, maximum: 480 })
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;
  @ApiPropertyOptional({ example: '120.00' })
  @IsOptional()
  @Matches(AMOUNT, AMOUNT_MSG)
  price?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() professionalId?: string;
}

export class UpdateServiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(480) durationMinutes?: number;
  @ApiPropertyOptional({ description: 'String vazia remove o valor.' })
  @IsOptional()
  @Matches(/^(\d{1,13}(\.\d{1,2})?)?$/, AMOUNT_MSG)
  price?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() professionalId?: string;
}

export class ServiceStatusDto {
  @ApiProperty({ enum: ServiceStatus }) @IsEnum(ServiceStatus) status!: ServiceStatus;
}

export class AvailabilityDto {
  @ApiProperty() @IsISO8601() startsAt!: string;
  @ApiProperty() @IsISO8601() endsAt!: string;
  @ApiPropertyOptional({ description: 'Restringe o horário a um serviço.' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class AvailabilityQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
}

export class AppointmentRequestDto {
  @ApiProperty() @IsUUID() serviceId!: string;
  @ApiProperty() @IsUUID() availabilityId!: string;
  @ApiPropertyOptional({
    description: 'Observação livre. Não informe dados de saúde (RN-PAR-008).'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AppointmentStatusDto {
  @ApiProperty({ enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) administrativeNotes?: string;
}

export class AppointmentQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() professionalId?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) to?: string;
}

export class SettlementDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) periodStart!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) periodEnd!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional({ description: 'Ajuste com sinal (ex.: -15.00).' })
  @IsOptional()
  @Matches(SIGNED_AMOUNT, AMOUNT_MSG)
  adjustmentAmount?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  adjustmentReason?: string;
}

export class SettlementStatusDto {
  @ApiProperty({ enum: PartnerSettlementStatus })
  @IsEnum(PartnerSettlementStatus)
  status!: PartnerSettlementStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
}

export class SettlementPayDto {
  @ApiProperty() @IsUUID() accountId!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) paidOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentMethodId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class SettlementQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PartnerSettlementStatus })
  @IsOptional()
  @IsEnum(PartnerSettlementStatus)
  status?: PartnerSettlementStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
}

export class SalesReportQueryDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) from!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) to!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string;
}
