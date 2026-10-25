import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

import { IsMobilePhoneBr } from '../../../common/validation/br-fields';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Exemplo' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'ana@exemplo.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '(68) 99999-0000' })
  @IsOptional()
  @IsMobilePhoneBr()
  phone?: string;

  @ApiProperty({ description: 'Aceite dos termos de uso e da política de privacidade.' })
  @IsBoolean()
  @Equals(true, { message: 'É necessário aceitar os termos e a política de privacidade.' })
  acceptTerms!: boolean;

  @ApiProperty({ description: 'Declaração de idade mínima de 12 anos (DT-026).' })
  @IsBoolean()
  @Equals(true, { message: 'É necessário declarar ter 12 anos ou mais.' })
  minimumAgeConfirmed!: boolean;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Houve uso real desde a última renovação (adia a expiração por inatividade).'
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(180)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsMobilePhoneBr({ allowEmpty: true })
  phone?: string;
}

export class MfaLoginDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  challengeToken!: string;

  @ApiProperty({ description: 'Código de 6 dígitos do autenticador ou de recuperação.' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}

export class MfaPasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class MfaCodeDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}

export class MfaPasswordCodeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}

/** Perfil público: aparecer no elenco do site com foto, nome e posição (DT-044). */
export class ProfileVisibilityDto {
  @ApiProperty() @IsBoolean() public!: boolean;
}
