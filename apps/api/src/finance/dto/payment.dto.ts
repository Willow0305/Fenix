import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';

const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u;
const SURPLUS_DISPOSITIONS = ['CREDIT', 'RETURN_PENDING', 'REVIEW_REQUIRED'] as const;

export class CreateFinancialPaymentDto {
  @ApiProperty()
  @IsUUID()
  public readonly accountId!: string;

  @ApiProperty({ example: '120.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;

  @ApiProperty({ example: '2026-08-10T15:00:00.000Z' })
  @IsDateString({ strict: true })
  public readonly paidAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly externalReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly privateAttachmentId?: string;
}

export class PaymentAllocationDto {
  @ApiProperty()
  @IsUUID()
  public readonly chargeId!: string;

  @ApiProperty({ example: '100.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;
}

export class ReconcileFinancialPaymentDto {
  @ApiProperty({ description: 'Categoria de entrada usada no razão.' })
  @IsUUID()
  public readonly incomeCategoryId!: string;

  @ApiProperty({ type: [PaymentAllocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  public readonly allocations!: PaymentAllocationDto[];

  @ApiPropertyOptional({ enum: SURPLUS_DISPOSITIONS })
  @IsOptional()
  @IsIn(SURPLUS_DISPOSITIONS)
  public readonly surplusDisposition?: (typeof SURPLUS_DISPOSITIONS)[number];

  @ApiProperty({ description: 'Motivo operacional da conciliação.' })
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  public readonly reason!: string;
}
