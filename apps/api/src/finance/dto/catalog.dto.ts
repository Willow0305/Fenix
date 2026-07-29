import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const ACCOUNT_TYPES = ['CASH', 'BANK', 'DIGITAL_WALLET', 'OTHER'] as const;
const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;
const CODE_PATTERN = /^[A-Z0-9_]+$/u;

export class CreateFinancialAccountDto {
  @ApiProperty({ example: 'CAIXA_SEDE' })
  @IsString()
  @Matches(CODE_PATTERN)
  @MinLength(2)
  @MaxLength(50)
  public readonly code!: string;

  @ApiProperty({ example: 'Caixa da sede' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  public readonly name!: string;

  @ApiProperty({ enum: ACCOUNT_TYPES })
  @IsIn(ACCOUNT_TYPES)
  public readonly type!: (typeof ACCOUNT_TYPES)[number];
}

export class CreateFinancialCategoryDto {
  @ApiProperty({ example: 'EVENTOS' })
  @IsString()
  @Matches(CODE_PATTERN)
  @MinLength(2)
  @MaxLength(50)
  public readonly code!: string;

  @ApiProperty({ example: 'Eventos' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  public readonly name!: string;

  @ApiProperty({ enum: CATEGORY_TYPES })
  @IsIn(CATEGORY_TYPES)
  public readonly type!: (typeof CATEGORY_TYPES)[number];
}

export class CreateCostCenterDto {
  @ApiProperty({ example: 'VOLEI_BASE' })
  @IsString()
  @Matches(CODE_PATTERN)
  @MinLength(2)
  @MaxLength(50)
  public readonly code!: string;

  @ApiProperty({ example: 'Vôlei de base' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  public readonly name!: string;
}
