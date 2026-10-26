import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinancialAccountType,
  FinancialCategoryNature,
  FinancialDirection,
  FinancialObligationStatus,
  FinancialObligationType,
  FinancialOrigin,
  FinancialTransactionStatus,
  MonthlyFeePlanStatus,
  MonthlyFeeStatus
} from '../../../generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { PageQueryDto } from '../../../common/http/pagination';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const DATE_MSG = { message: 'Data inválida (AAAA-MM-DD).' };
const AMOUNT_MSG = { message: 'Valor inválido: use ponto e até 2 casas (ex.: 89.90).' };

export class ReasonBodyDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

// ---------- Cadastros ----------

export class AccountDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ enum: FinancialAccountType })
  @IsEnum(FinancialAccountType)
  type!: FinancialAccountType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) institutionName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Informe os 4 últimos dígitos.' })
  accountLastFour?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) institutionName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Informe os 4 últimos dígitos.' })
  accountLastFour?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FinanceCategoryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ enum: FinancialCategoryNature })
  @IsEnum(FinancialCategoryNature)
  nature!: FinancialCategoryNature;
}

export class NameActiveDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class NameDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
}

export class ActiveDto {
  @ApiProperty() @IsBoolean() isActive!: boolean;
}

// ---------- Lançamentos ----------

export class TransactionQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() accountId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() costCenterId?: string;
  @ApiPropertyOptional({ enum: FinancialDirection })
  @IsOptional()
  @IsEnum(FinancialDirection)
  direction?: FinancialDirection;
  @ApiPropertyOptional({ enum: FinancialTransactionStatus })
  @IsOptional()
  @IsEnum(FinancialTransactionStatus)
  status?: FinancialTransactionStatus;
  @ApiPropertyOptional({ enum: FinancialOrigin })
  @IsOptional()
  @IsEnum(FinancialOrigin)
  origin?: FinancialOrigin;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) to?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  withoutAttachment?: boolean;
}

export class ManualTransactionDto {
  @ApiProperty() @IsUUID() accountId!: string;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() costCenterId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentMethodId?: string;
  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] })
  @IsEnum(FinancialDirection)
  direction!: FinancialDirection;
  @ApiProperty({ example: '150.00' }) @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) occurredOn!: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) competenceDate?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() confirmNow?: boolean;
}

export class ReconcileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) statementReference?: string;
}

export class TransferDto {
  @ApiProperty() @IsUUID() sourceAccountId!: string;
  @ApiProperty() @IsUUID() destinationAccountId!: string;
  @ApiProperty() @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) occurredOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class OpeningBalanceDto {
  @ApiProperty() @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) occurredOn!: string;
  @ApiProperty({ description: 'Origem do saldo (extrato, contagem, documento).' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  notes!: string;
}

export class SummaryQueryDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) from!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) to!: string;
}

// ---------- Obrigações ----------

export class ObligationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: FinancialObligationType })
  @IsOptional()
  @IsEnum(FinancialObligationType)
  type?: FinancialObligationType;
  @ApiPropertyOptional({ enum: FinancialObligationStatus })
  @IsOptional()
  @IsEnum(FinancialObligationStatus)
  status?: FinancialObligationStatus;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) from?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(DATE, DATE_MSG) to?: string;
}

export class ObligationDto {
  @ApiProperty({ enum: FinancialObligationType })
  @IsEnum(FinancialObligationType)
  type!: FinancialObligationType;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() costCenterId?: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(180) counterpartyName!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) description!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) competenceDate!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) dueDate!: string;
  @ApiProperty() @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class SettleDto {
  @ApiProperty() @IsUUID() accountId!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) paidOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentMethodId?: string;
}

// ---------- Fechamento ----------

export class ClosingPreviewDto {
  @ApiProperty() @IsUUID() accountId!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) periodStart!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) periodEnd!: string;
}

export class ClosingDto extends ClosingPreviewDto {
  @ApiProperty() @Matches(AMOUNT, AMOUNT_MSG) countedBalance!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ClosingListDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() accountId?: string;
}

// ---------- Mensalidades ----------

export class PlanDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({ example: '80.00' }) @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiProperty({ minimum: 1, maximum: 31 }) @IsInt() @Min(1) @Max(31) dueDay!: number;
}

export class UpdatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, AMOUNT_MSG) amount?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
  @ApiPropertyOptional({ enum: MonthlyFeePlanStatus })
  @IsOptional()
  @IsEnum(MonthlyFeePlanStatus)
  status?: MonthlyFeePlanStatus;
}

export class AssignPlanDto {
  @ApiProperty() @IsUUID() planId!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) startsOn!: string;
  @ApiPropertyOptional({ description: 'Valor individual (bolsa/desconto).' })
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, AMOUNT_MSG)
  amountOverride?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

/** Vários atletas no plano de uma vez (docs/29 COR-021). */
export class AssignManyDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  athleteIds!: string[];
  @ApiProperty() @Matches(DATE, DATE_MSG) startsOn!: string;
  @ApiPropertyOptional({ description: 'Valor individual igual para todos os selecionados.' })
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, AMOUNT_MSG)
  amountOverride?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @ApiPropertyOptional({ description: 'Troca o plano vigente de quem já tem outro.' })
  @IsOptional()
  @IsBoolean()
  replaceCurrent?: boolean;
}

export class DueDateDto extends ReasonBodyDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) dueDate!: string;
}

export class EndPlanDto extends ReasonBodyDto {
  @ApiProperty() @Matches(DATE, DATE_MSG) endsOn!: string;
}

export class GenerateFeesDto {
  @ApiProperty({ example: '2026-11' })
  @Matches(MONTH, { message: 'Mês inválido (AAAA-MM).' })
  referenceMonth!: string;
}

export class FeeQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: '2026-11' })
  @IsOptional()
  @Matches(MONTH, { message: 'Mês inválido (AAAA-MM).' })
  referenceMonth?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() athleteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teamId?: string;
  @ApiPropertyOptional({ enum: MonthlyFeeStatus })
  @IsOptional()
  @IsEnum(MonthlyFeeStatus)
  status?: MonthlyFeeStatus;
}

export class FeePaymentDto {
  @ApiProperty() @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiProperty() @IsUUID() paymentMethodId!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) paidOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional({ description: 'Informe para confirmar já e lançar no Caixa nesta conta.' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class ConfirmPaymentDto {
  @ApiProperty() @IsUUID() accountId!: string;
}

export class AdjustFeeDto extends ReasonBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, AMOUNT_MSG)
  discountAmount?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, AMOUNT_MSG)
  additionalAmount?: string;
}

export class ProofDto {
  @ApiProperty() @Matches(AMOUNT, AMOUNT_MSG) amount!: string;
  @ApiProperty() @Matches(DATE, DATE_MSG) paidOn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class TrendQueryDto {
  @ApiPropertyOptional({ minimum: 3, maximum: 24, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(24)
  months?: number;
}
