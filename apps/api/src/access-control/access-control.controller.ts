import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Req
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RateLimited } from '../rate-limit/rate-limit.decorator';
import { PERMISSION_CODES } from './access.constants';
import { RequirePermissions } from './access.decorators';
import { AccessControlService } from './access-control.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@ApiTags('papéis e permissões')
@Controller()
export class AccessControlController {
  public constructor(private readonly accessControl: AccessControlService) {}

  @Get('roles')
  @RequirePermissions(PERMISSION_CODES.usersRead)
  @ApiOperation({ summary: 'Lista papéis e permissões efetivas da Fase 1.' })
  public listRoles() {
    return this.accessControl.listRoles();
  }

  @Get('permissions')
  @RequirePermissions(PERMISSION_CODES.permissionsManage)
  @ApiOperation({ summary: 'Lista o catálogo atômico de permissões da Fase 1.' })
  public listPermissions() {
    return this.accessControl.listPermissions();
  }

  @Put('roles/:roleId/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.permissionsManage)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Substitui permissões de um papel não protegido.' })
  public async replaceRolePermissions(
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body() body: UpdateRolePermissionsDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.accessControl.replaceRolePermissions(
      roleId,
      body.permissionCodes,
      principal.userId,
      request
    );
  }
}
