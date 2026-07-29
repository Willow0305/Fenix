import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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

const CODE_PATTERN = /^[A-Z0-9_]+$/u;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u;
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const COMPETENCE_PATTERN = /^\d{4}-\d{2}-01$/u;

export class CreateFinancialPlanDto {
  @ApiProperty({ example: 'PLANO_SOCIAL' })
  @IsString()
  @Matches(CODE_PATTERN)
  @MinLength(2)
  @MaxLength(50)
  public readonly code!: string;

  @ApiProperty({ example: 'Plano social fictício' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  public readonly name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public readonly description?: string;
}

export class CreateFinancialPlanVersionDto {
  @ApiProperty({ example: '120.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(28)
  public readonly billingDay!: number;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  @Matches(CIVIL_DATE_PATTERN)
  public readonly effectiveFrom!: string;

  @ApiPropertyOptional({ description: 'Resumo não sensível das regras desta versão.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public readonly rulesSummary?: string;
}

export class CreateFinancialChargeDto {
  @ApiProperty({ example: 'COB-2026-08-001' })
  @IsString()
  @Matches(/^[A-Z0-9_.-]+$/u)
  @MinLength(4)
  @MaxLength(80)
  public readonly referenceCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly planVersionId?: string;

  @ApiProperty({ example: 'Cobrança fictícia da competência' })
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  public readonly description!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  @Matches(COMPETENCE_PATTERN)
  public readonly competence!: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsString()
  @Matches(CIVIL_DATE_PATTERN)
  public readonly dueDate!: string;

  @ApiProperty({ example: '120.00', type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  public readonly amount!: string;
}
