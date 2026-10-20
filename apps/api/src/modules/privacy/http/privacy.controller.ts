import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { PrivacyRequestStatus, PrivacyRequestType } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';

import { type Page, PageQueryDto } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { defined } from '../../../common/util/defined';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { RequirePermissions } from '../../auth/http/auth.decorators';
import { PrivacyService, type PrivacyRequestView } from '../application/privacy.service';

export class PrivacyRequestDto {
  @ApiProperty({ enum: PrivacyRequestType }) @IsEnum(PrivacyRequestType) type!: PrivacyRequestType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) details?: string;
}

export class PrivacyQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PrivacyRequestStatus })
  @IsOptional()
  @IsEnum(PrivacyRequestStatus)
  status?: PrivacyRequestStatus;
}

export class PrivacyUpdateDto {
  @ApiProperty({ enum: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'] })
  @IsIn(['IN_PROGRESS', 'COMPLETED', 'REJECTED'])
  status!: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  resolution?: string;
}

export class AnonymizeDto {
  @ApiProperty({ description: 'Registro do atendimento e do que foi mantido por obrigação legal.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

@ApiTags('privacy')
@ApiBearerAuth()
@Controller()
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  /** Exportação imediata dos próprios dados (LGPD art. 18, II e V). */
  @Get('me/privacy/export')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async export(
    @CurrentPrincipal() principal: Principal,
    @ReqMeta() meta: RequestMeta,
    @Res() res: Response
  ): Promise<void> {
    const data = await this.privacy.exportOwn(principal, meta);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-fenix.json"');
    res.send(JSON.stringify(data, null, 2));
  }

  @Get('me/privacy/requests')
  mine(@CurrentPrincipal() principal: Principal): Promise<PrivacyRequestView[]> {
    return this.privacy.mine(principal.userId);
  }

  @Post('me/privacy/requests')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  request(
    @CurrentPrincipal() principal: Principal,
    @Body() body: PrivacyRequestDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PrivacyRequestView> {
    return this.privacy.request(principal, defined(body), meta);
  }

  @Get('privacy-requests')
  @RequirePermissions(PERMISSIONS.privacyRequestsManage)
  list(@Query() query: PrivacyQueryDto): Promise<Page<PrivacyRequestView>> {
    return this.privacy.list(defined(query));
  }

  @Put('privacy-requests/:id')
  @RequirePermissions(PERMISSIONS.privacyRequestsManage)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PrivacyUpdateDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PrivacyRequestView> {
    return this.privacy.update(actor, id, body.status, body.resolution, meta);
  }

  @Post('privacy-requests/:id/anonymize')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.privacyRequestsManage, PERMISSIONS.usersUpdate)
  anonymize(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AnonymizeDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PrivacyRequestView> {
    return this.privacy.anonymize(actor, id, body.reason, meta);
  }
}

@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService]
})
export class PrivacyModule {}
