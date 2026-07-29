import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u;
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ENTRY_TYPES = ['INCOME', 'EXPENSE', 'ADJUSTMENT'] as const;
const OBLIGATION_TYPES = ['PAYABLE', 'RECEIVABLE'] as const;

export class CreatePendingFinancialTransactionDto {
  @ApiProperty()
  @IsUUID()
  public readonly accountId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly obligationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly cashSessionId?: string;

  @ApiProperty({ enum: ENTRY_TYPES })
  @IsIn(ENTRY_TYPES)
  public readonly type!: (typeof ENTRY_TYPES)[number];

  @ApiProperty({ example: '50.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  public readonly description!: string;

  @ApiProperty({ example: '2026-08-10T15:00:00.000Z' })
  @IsDateString({ strict: true })
  public readonly occurredAt!: string;
}

export class FinancialDecisionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  public readonly reason!: string;
}

export class CreateFinancialTransferDto {
  @ApiProperty()
  @IsUUID()
  public readonly sourceAccountId!: string;

  @ApiProperty()
  @IsUUID()
  public readonly targetAccountId!: string;

  @ApiProperty({ example: '200.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  public readonly description!: string;

  @ApiProperty({ example: '2026-08-10T15:00:00.000Z' })
  @IsDateString({ strict: true })
  public readonly occurredAt!: string;
}

export class CreateFinancialObligationDto {
  @ApiProperty({ enum: OBLIGATION_TYPES })
  @IsIn(OBLIGATION_TYPES)
  public readonly type!: (typeof OBLIGATION_TYPES)[number];

  @ApiProperty()
  @IsUUID()
  public readonly categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly accountId?: string;

  @ApiProperty({ example: 'PAG-2026-001' })
  @IsString()
  @Matches(/^[A-Z0-9_.-]+$/u)
  @MinLength(4)
  @MaxLength(80)
  public readonly referenceCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  public readonly description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  public readonly counterpartyReference?: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsString()
  @Matches(CIVIL_DATE_PATTERN)
  public readonly dueDate!: string;

  @ApiProperty({ example: '300.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;
}
