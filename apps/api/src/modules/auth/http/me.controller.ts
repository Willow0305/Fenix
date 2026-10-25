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
import { Throttle } from '@nestjs/throttler';

import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { AccountService, type ProfileView, type SessionView } from '../application/account.service';
import { AuthService } from '../application/auth.service';
import { MfaService, type MfaSetupView, type MfaStatusView } from '../application/mfa.service';
import {
  ChangePasswordDto,
  MfaCodeDto,
  MfaPasswordCodeDto,
  MfaPasswordDto,
  UpdateProfileDto
} from './auth.dto';

const MFA_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
    private readonly mfa: MfaService
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

  // ----- Login em duas etapas (DT-037) -----

  @Get('mfa')
  mfaStatus(@CurrentPrincipal() principal: Principal): Promise<MfaStatusView> {
    return this.mfa.status(principal);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @Throttle(MFA_LIMIT)
  mfaSetup(
    @CurrentPrincipal() principal: Principal,
    @Body() body: MfaPasswordDto
  ): Promise<MfaSetupView> {
    return this.mfa.beginSetup(principal, body.password);
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @Throttle(MFA_LIMIT)
  async mfaEnable(
    @CurrentPrincipal() principal: Principal,
    @Body() body: MfaCodeDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ recoveryCodes: string[] }> {
    return { recoveryCodes: await this.mfa.enable(principal, body.code, meta) };
  }

  @Post('mfa/recovery-codes')
  @HttpCode(200)
  @Throttle(MFA_LIMIT)
  async mfaRecoveryCodes(
    @CurrentPrincipal() principal: Principal,
    @Body() body: MfaPasswordCodeDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ recoveryCodes: string[] }> {
    return {
      recoveryCodes: await this.mfa.regenerateRecoveryCodes(
        principal,
        body.password,
        body.code,
        meta
      )
    };
  }

  @Post('mfa/disable')
  @HttpCode(204)
  @Throttle(MFA_LIMIT)
  async mfaDisable(
    @CurrentPrincipal() principal: Principal,
    @Body() body: MfaPasswordCodeDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.mfa.disable(principal, body.password, body.code, meta);
  }
}
