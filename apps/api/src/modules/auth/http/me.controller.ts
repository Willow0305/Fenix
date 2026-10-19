import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { AccountService, type ProfileView, type SessionView } from '../application/account.service';
import { AuthService } from '../application/auth.service';
import { ChangePasswordDto, UpdateProfileDto } from './auth.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService
  ) {}

  @Get()
  profile(@CurrentPrincipal() principal: Principal): Promise<ProfileView> {
    return this.account.profile(principal);
  }

  @Patch()
  update(
    @CurrentPrincipal() principal: Principal,
    @Body() body: UpdateProfileDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProfileView> {
    return this.account.updateProfile(
      principal,
      {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.phone === undefined ? {} : { phone: body.phone })
      },
      meta
    );
  }

  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ChangePasswordDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.auth.changePassword(
      principal.userId,
      principal.sessionId,
      body.currentPassword,
      body.newPassword,
      meta
    );
  }

  @Get('sessions')
  sessions(@CurrentPrincipal() principal: Principal): Promise<SessionView[]> {
    return this.account.sessions(principal);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.account.revokeSession(principal, id, meta);
  }
}
