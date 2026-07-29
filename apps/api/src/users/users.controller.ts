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
  Put,
  Query,
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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('usuários')
@Controller('users')
export class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.usersRead)
  @ApiOperation({ summary: 'Lista contas administrativas com paginação limitada.' })
  public list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSION_CODES.usersCreate)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Cria uma conta comum, sem privilégio implícito.' })
  public create(
    @Body() body: CreateUserDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.users.create(body, principal.userId, request);
  }

  @Patch(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.usersUpdate)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Atualiza o nome permitido da conta.' })
  public async update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateUserDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.users.updateName(userId, body.name, principal.userId, request);
  }

  @Put(':userId/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.usersUpdate)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Bloqueia, inativa ou reativa uma conta.' })
  public async updateStatus(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.users.updateStatus(userId, body.status, principal.userId, request);
  }

  @Put(':userId/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.rolesAssign)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Substitui os papéis atribuídos a uma conta.' })
  public async replaceRoles(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateUserRolesDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.users.replaceRoles(userId, body.roleCodes, principal.userId, request);
  }

  @Post(':userId/revoke-sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.sessionsRevoke)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Revoga todas as sessões ativas da conta.' })
  public async revokeSessions(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.users.revokeSessions(userId, principal.userId, request);
  }

  @Post(':userId/mfa/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.mfaManage)
  @RateLimited('adminSensitive')
  @ApiOperation({ summary: 'Redefine MFA com proteção do último administrador seguro.' })
  public async resetMfa(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.users.resetMfa(userId, principal.userId, request);
  }
}
