import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

const CATEGORY_KINDS = ['AGE_GROUP', 'GENDER', 'LEVEL', 'DIVISION', 'OTHER'] as const;

export class CreateSportCategoryDto {
  @ApiPropertyOptional({ example: 'SUB_18' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]+$/u)
  @MinLength(2)
  @MaxLength(50)
  public readonly code?: string;

  @ApiProperty({ example: 'Sub-18' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  public readonly name!: string;

  @ApiPropertyOptional({ example: 'sub-18' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(120)
  public readonly slug?: string;

  @ApiProperty({ enum: CATEGORY_KINDS })
  @IsIn(CATEGORY_KINDS)
  public readonly kind!: (typeof CATEGORY_KINDS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  public readonly minimumAge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  public readonly maximumAge?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  public readonly isActive?: boolean;
}

export class UpdateSportCategoryDto extends PartialType(CreateSportCategoryDto) {}
