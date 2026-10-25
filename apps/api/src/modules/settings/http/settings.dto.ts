import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';

import { IsPhoneBr } from '../../../common/validation/br-fields';

export class SocialLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(300)
  url!: string;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class UpdatePublicSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(160) teamName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  officialName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) history?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneBr()
  phone?: string;

  @ApiPropertyOptional({ type: [SocialLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) addressCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) addressState?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) addressPostalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 2) addressCountry?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Cor inválida.' })
  primaryColor?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Cor inválida.' })
  secondaryColor?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, { message: 'Fuso horário inválido.' })
  timeZone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50000) termsOfUse?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50000) privacyPolicy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) monthlyFeeRules?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) storeRules?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) pickupInstructions?: string;
}

export class UpdateFinancialSettingsDto {
  @ApiPropertyOptional({ description: 'Chave PIX; string vazia remove.' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  pixKey?: string;

  @ApiPropertyOptional({ description: 'Dados bancários em texto livre; string vazia remove.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bankingDetails?: string;
}

export class BrandAssetBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  altText?: string;
}
