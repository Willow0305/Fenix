import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { AppConfig } from '../../../common/config/app-config';
import { AppError } from '../../../common/errors/app-error';
import {
  type ContextRequest,
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { AuthService, type IssuedSession, type MfaChallenge } from '../application/auth.service';
import {
  TrustedDevicesService,
  type TrustedDeviceView
} from '../application/trusted-devices.service';
import { Public } from './auth.decorators';
import {
  ForgotPasswordDto,
  LoginDto,
  MfaLoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto
} from './auth.dto';

export const REFRESH_COOKIE = 'fenix_rt';
/** Navegador lembrado na segunda etapa (DT-050); mesmo caminho do refresh. */
export const DEVICE_COOKIE = 'fenix_dv';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function readCookie(req: ContextRequest, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];

  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined;
}
const STRICT_LIMIT = { default: { limit: 10, ttl: 60_000 } };

export interface AccessTokenResponse {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly idleTimeoutSeconds: number;
}

@ApiTags('Autenticação')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig
  ) {}

  private cookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.values.isProduction,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      ...(expires === undefined ? {} : { expires })
    };
  }

  private respond(res: Response, session: IssuedSession): AccessTokenResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions(session.refreshExpiresAt));
    res.setHeader('Cache-Control', 'no-store');

    return {
      accessToken: session.accessToken,
      tokenType: 'Bearer',
      expiresIn: session.expiresIn,
      idleTimeoutSeconds: session.idleTimeoutSeconds
    };
  }

  /** Mitigação de CSRF para rotas baseadas em cookie: rejeita Origin de terceiros. */
  private assertSameOrigin(req: ContextRequest): void {
    const origin = req.header('origin');

    if (origin !== undefined && origin !== this.config.values.webOrigin) {
      throw AppError.forbidden('Origem não permitida.');
    }
  }

  private readRefreshCookie(req: ContextRequest): string | undefined {
    return readCookie(req, REFRESH_COOKIE);
  }

  @Post('register')
  @Throttle(STRICT_LIMIT)
  async register(
    @Body() body: RegisterDto,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response
  ): Promise<AccessTokenResponse> {
    const session = await this.auth.register(
      {
        name: body.name,
        email: body.email,
        password: body.password,
        ...(body.phone === undefined ? {} : { phone: body.phone })
      },
      meta
    );

    return this.respond(res, session);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT_LIMIT)
  async login(
    @Body() body: LoginDto,
    @Req() req: ContextRequest,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response
  ): Promise<AccessTokenResponse | MfaChallenge> {
    const result = await this.auth.login(
      body.email,
      body.password,
      meta,
      readCookie(req, DEVICE_COOKIE)
    );

    if ('mfaRequired' in result) {
      res.setHeader('Cache-Control', 'no-store');

      return result;
    }

    return this.respond(res, result);
  }

  /** Segunda etapa do login (DT-037). */
  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle(STRICT_LIMIT)
  async verifyMfa(
    @Body() body: MfaLoginDto,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response
  ): Promise<AccessTokenResponse> {
    const session = await this.auth.verifyMfaLogin(
      body.challengeToken,
      body.code,
      meta,
      body.rememberDevice === true
    );

    if (session.device) {
      res.cookie(DEVICE_COOKIE, session.device.token, this.cookieOptions(session.device.expiresAt));
    }

    return this.respond(res, session);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: ContextRequest,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response
  ): Promise<AccessTokenResponse> {
    this.assertSameOrigin(req);
    const token = this.readRefreshCookie(req);

    if (token === undefined) {
      throw AppError.unauthorized('Sessão expirada. Entre novamente.');
    }

    try {
      return this.respond(res, await this.auth.refresh(token, meta, body.active === true));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: ContextRequest,
    @ReqMeta() meta: RequestMeta,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    this.assertSameOrigin(req);
    await this.auth.logout(this.readRefreshCookie(req), meta);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Post('password/forgot')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgot(
    @Body() body: ForgotPasswordDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ message: string }> {
    await this.auth.requestPasswordReset(body.email, meta);

    return {
      message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.'
    };
  }

  @Post('password/reset')
  @HttpCode(204)
  @Throttle(STRICT_LIMIT)
  async reset(@Body() body: ResetPasswordDto, @ReqMeta() meta: RequestMeta): Promise<void> {
    await this.auth.resetPassword(body.token, body.password, meta);
  }
}

/** Navegadores lembrados da própria conta (DT-050). Exige login. */
@ApiTags('Autenticação')
@ApiBearerAuth()
@Controller('auth/trusted-devices')
export class TrustedDevicesController {
  constructor(
    private readonly devices: TrustedDevicesService,
    private readonly config: AppConfig
  ) {}

  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Req() req: ContextRequest
  ): Promise<TrustedDeviceView[]> {
    return this.devices.list(principal.userId, readCookie(req, DEVICE_COOKIE));
  }

  @Delete(':id')
  @HttpCode(204)
  async forget(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.devices.forget(principal.userId, id, meta);
  }

  @Delete()
  @HttpCode(200)
  async forgetAll(
    @CurrentPrincipal() principal: Principal,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ forgotten: number }> {
    res.clearCookie(DEVICE_COOKIE, {
      httpOnly: true,
      secure: this.config.values.isProduction,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH
    });

    return {
      forgotten: await this.devices.forgetAll(principal.userId, 'Esquecidos pela pessoa')
    };
  }
}
