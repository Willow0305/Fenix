import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../../generated/prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from 'class-validator';

import { PageQueryDto } from '../../../common/http/pagination';
import { IsMobilePhoneBr } from '../../../common/validation/br-fields';

export class AccessReasonDto {
  @ApiProperty({ description: 'Motivo registrado na auditoria.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class UserListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;
}

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMobilePhoneBr({ allowEmpty: true })
  phone?: string;

  @ApiProperty({ type: [String], example: ['user'] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  roles!: string[];
}

export class SetRolesDto extends AccessReasonDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  roles!: string[];
}

export class SetStatusDto extends AccessReasonDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class SetPermissionsDto extends AccessReasonDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions!: string[];
}

/** Papel criado pela administração (DT-078). */
export class RoleDto {
  @ApiProperty({ example: 'Financeiro' }) @IsString() @MinLength(3) @MaxLength(80) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissions?: string[];
  @ApiPropertyOptional({ description: 'Copiar as permissões deste papel (código).' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  copyFrom?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class AuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Correlaciona todas as ações de uma mesma requisição.' })
  @IsOptional()
  @IsUUID()
  requestId?: string;
}
