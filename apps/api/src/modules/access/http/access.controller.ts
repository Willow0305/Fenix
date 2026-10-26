import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { Page } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { MfaService } from '../../auth/application/mfa.service';
import { RequirePermissions } from '../../auth/http/auth.decorators';
import { AuditQueryService, type AuditLogView } from '../application/audit-query.service';
import { RolesService, type RoleView } from '../application/roles.service';
import { type AdminUserView, UsersAdminService } from '../application/users-admin.service';
import { PERMISSIONS } from '../domain/permission-catalog';
import {
  AuditQueryDto,
  CreateUserDto,
  ReasonDto,
  SetPermissionsDto,
  SetRolesDto,
  SetStatusDto,
  UserListQueryDto
} from './access.dto';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersAdminService,
    private readonly mfa: MfaService
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.usersRead)
  list(@Query() query: UserListQueryDto): Promise<Page<AdminUserView>> {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.usersRead)
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserView> {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.usersCreate, PERMISSIONS.rolesAssign)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: CreateUserDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminUserView> {
    return this.users.create(
      actor,
      {
        name: body.name,
        email: body.email,
        roles: body.roles,
        ...(body.phone === undefined ? {} : { phone: body.phone })
      },
      meta
    );
  }

  @Put(':id/roles')
  @RequirePermissions(PERMISSIONS.rolesAssign)
  setRoles(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SetRolesDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminUserView> {
    return this.users.setRoles(actor, id, body.roles, body.reason, meta);
  }

  @Put(':id/status')
  @RequirePermissions(PERMISSIONS.usersUpdate)
  setStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SetStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AdminUserView> {
    return this.users.setStatus(actor, id, body.status, body.reason, meta);
  }

  @Post(':id/sessions/revoke')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.sessionsRevoke)
  async revokeSessions(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ revoked: number }> {
    return { revoked: await this.users.revokeSessions(actor, id, body.reason, meta) };
  }

  /** Remove a segunda etapa de quem perdeu o celular e os códigos (DT-037). */
  @Post(':id/mfa/reset')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.usersUpdate, PERMISSIONS.sessionsRevoke)
  async resetMfa(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.mfa.adminReset(actor, id, body.reason, meta);
  }
}

@ApiTags('Papéis e permissões')
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @RequirePermissions(PERMISSIONS.usersRead)
  list(): Promise<RoleView[]> {
    return this.roles.list();
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.usersRead)
  permissions(): { code: string; name: string }[] {
    return this.roles.permissions();
  }

  @Put('roles/:code/permissions')
  @RequirePermissions(PERMISSIONS.permissionsManage)
  setPermissions(
    @CurrentPrincipal() actor: Principal,
    @Param('code') code: string,
    @Body() body: SetPermissionsDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<RoleView> {
    return this.roles.setPermissions(actor, code, body.permissions, body.reason, meta);
  }
}

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.auditRead)
  list(@Query() query: AuditQueryDto): Promise<Page<AuditLogView>> {
    return this.audit.list(query);
  }

  @Get('entity-types')
  @RequirePermissions(PERMISSIONS.auditRead)
  entityTypes(): Promise<string[]> {
    return this.audit.entityTypes();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.auditRead)
  get(
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<AuditLogView & { related: AuditLogView[] }> {
    return this.audit.get(id);
  }
}
