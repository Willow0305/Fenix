import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSION_CODES } from '../access-control/access.constants';
import { RequirePermissions } from '../access-control/access.decorators';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import { RateLimited } from '../rate-limit/rate-limit.decorator';
import { CreateDataSubjectRequestDto } from './dto/create-data-subject-request.dto';
import { RunRetentionDto } from './dto/run-retention.dto';
import { UpdateDataSubjectRequestDto } from './dto/update-data-subject-request.dto';
import { PrivacyService } from './privacy.service';

@ApiTags('privacidade e retenção')
@Controller('privacy')
export class PrivacyController {
  public constructor(private readonly privacy: PrivacyService) {}

  @Get('requests')
  @RequirePermissions(PERMISSION_CODES.privacyRequestsManage)
  public listRequests() {
    return this.privacy.listRequests();
  }

  @Post('requests')
  @RequirePermissions(PERMISSION_CODES.privacyRequestsManage)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Registra solicitação de titular com protocolo.' })
  public createRequest(
    @Body() body: CreateDataSubjectRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.privacy.createRequest(body, principal.userId, request);
  }

  @Patch('requests/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.privacyRequestsManage)
  @RateLimited('adminSensitive')
  public async updateRequest(
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() body: UpdateDataSubjectRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.privacy.updateRequest(
      requestId,
      body.status,
      body.decisionReason,
      principal.userId,
      request
    );
  }

  @Post('retention-runs')
  @RequirePermissions(PERMISSION_CODES.retentionExecute)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Executa ou simula a política técnica de retenção.' })
  public runRetention(
    @Body() body: RunRetentionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.privacy.runRetention(body.dryRun, principal.userId, request);
  }
}
