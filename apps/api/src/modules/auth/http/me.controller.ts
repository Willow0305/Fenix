import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import type { IncomingFile } from '../../media/application/media.service';
import { UPLOAD_LIMITS } from '../../settings/http/settings.controller';
import { AccountService, type ProfileView, type SessionView } from '../application/account.service';
import { AuthService } from '../application/auth.service';
import { MfaService, type MfaSetupView, type MfaStatusView } from '../application/mfa.service';
import {
  ChangePasswordDto,
  MfaCodeDto,
  MfaPasswordCodeDto,
  MfaPasswordDto,
  ProfileVisibilityDto,
  UpdateProfileDto
} from './auth.dto';

const MFA_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Minha conta')
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

  @Put('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  avatar(
    @CurrentPrincipal() principal: Principal,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProfileView> {
    return this.account.setAvatar(principal, file, meta);
  }

  @Delete('avatar')
  removeAvatar(
    @CurrentPrincipal() principal: Principal,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProfileView> {
    return this.account.removeAvatar(principal, meta);
  }

  @Put('profile-visibility')
  profileVisibility(
    @CurrentPrincipal() principal: Principal,
    @Body() body: ProfileVisibilityDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProfileView> {
    return this.account.setProfileVisibility(principal, body.public, meta);
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
