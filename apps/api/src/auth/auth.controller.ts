import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../access-control/access.decorators';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import { RateLimited } from '../rate-limit/rate-limit.decorator';
import { AuthConfig } from './auth.config';
import { AuthService, type SessionCredentials } from './auth.service';
import { CurrentPrincipal } from './current-principal.decorator';
import { DisableMfaDto } from './dto/disable-mfa.dto';
import { LoginDto } from './dto/login.dto';
import { MfaChallengeDto } from './dto/mfa-challenge.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { MfaService } from './mfa.service';

@ApiTags('autenticação')
@Controller('auth')
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly config: AuthConfig,
    private readonly emailVerification: EmailVerificationService,
    private readonly mfa: MfaService
  ) {}

  @Post('login')
  @Public()
  @RateLimited('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia uma sessão revogável por e-mail e senha.' })
  public async login(
    @Body() body: LoginDto,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(body.email, body.password, { request });

    if (result.status === 'MFA_REQUIRED') {
      this.clearSessionCookies(response);

      return {
        status: result.status,
        challengeToken: result.challengeToken,
        expiresAt: result.expiresAt.toISOString()
      };
    }

    this.setSessionCookies(response, result);

    return this.toSessionResponse(result);
  }

  @Post('mfa/challenge')
  @Public()
  @RateLimited('mfaChallenge')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conclui o desafio TOTP ou por código de recuperação.' })
  public async completeMfaChallenge(
    @Body() body: MfaChallengeDto,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.completeMfaLogin(body.challengeToken, body.code, {
      request
    });

    this.setSessionCookies(response, result);

    return this.toSessionResponse(result);
  }

  @Post('refresh')
  @Public()
  @RateLimited('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotaciona o refresh token e renova a sessão ativa.' })
  public async refresh(
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = this.authService.readCookie(request, this.config.refreshCookieName);

    await this.authService.assertRefreshCsrf(request, refreshToken);
    const result = await this.authService.refresh(refreshToken, { request });

    this.setSessionCookies(response, result);

    return this.toSessionResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Revoga a sessão atual e remove seus cookies.' })
  public async logout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    await this.authService.logout(principal, { request });
    this.clearSessionCookies(response);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOkResponse()
  @ApiOperation({ summary: 'Retorna a identidade e as permissões efetivas da sessão.' })
  public me(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return {
      user: {
        id: principal.userId,
        name: principal.name,
        email: principal.email,
        emailVerified: principal.emailVerified,
        mfaEnabled: principal.mfaEnabled,
        mfaVerified: principal.mfaVerified,
        mfaEnrollmentRequired: principal.mfaEnrollmentRequired,
        roles: principal.roles,
        permissions: principal.permissions
      }
    };
  }

  @Post('password-recovery')
  @Public()
  @RateLimited('passwordRecovery')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicita código de recuperação com resposta não enumerável.' })
  public async requestPasswordRecovery(
    @Body() body: RequestPasswordRecoveryDto,
    @Req() request: RequestWithPrincipal
  ) {
    await this.authService.requestPasswordRecovery(body.email, { request });

    return {
      message: 'Se a conta estiver disponível, as instruções serão enviadas ao e-mail informado.'
    };
  }

  @Post('password-reset')
  @Public()
  @RateLimited('codeValidation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Valida um código de uso único e redefine a senha.' })
  public async resetPassword(
    @Body() body: ResetPasswordDto,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.authService.resetPassword(body.email, body.code, body.newPassword, { request });
  }

  @Post('email-verification/resend')
  @Public()
  @RateLimited('emailVerificationResend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reenvia verificação sem revelar a existência da conta.' })
  public async resendEmailVerification(
    @Body() body: ResendEmailVerificationDto,
    @Req() request: RequestWithPrincipal
  ) {
    await this.emailVerification.request(body.email, request);

    return {
      message: 'Se a conta estiver disponível, a verificação será enviada.'
    };
  }

  @Post('email-verification/confirm')
  @Public()
  @RateLimited('codeValidation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirma um código de verificação de e-mail de uso único.' })
  public async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.emailVerification.verify(body.email, body.code, request);
  }

  @Post('mfa/enrollment')
  @RateLimited('mfaChallenge')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Inicia configuração TOTP e retorna segredo somente uma vez.' })
  public beginMfaEnrollment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.mfa.beginEnrollment(principal, request);
  }

  @Post('mfa/enrollment/confirm')
  @RateLimited('mfaChallenge')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confirma TOTP e retorna códigos de recuperação somente uma vez.' })
  public confirmMfaEnrollment(
    @Body() body: MfaCodeDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.mfa.confirmEnrollment(principal, body.code, request);
  }

  @Post('mfa/disable')
  @RateLimited('mfaChallenge')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativa MFA após senha e segundo fator válidos.' })
  public async disableMfa(
    @Body() body: DisableMfaDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ): Promise<void> {
    await this.mfa.disable(principal, body.password, body.code, request);
  }

  private setSessionCookies(response: Response, result: SessionCredentials): void {
    const baseOptions = {
      sameSite: 'lax' as const,
      secure: this.config.cookieSecure
    };

    response.cookie(this.config.accessCookieName, result.accessToken, {
      ...baseOptions,
      expires: result.accessExpiresAt,
      httpOnly: true,
      path: '/'
    });
    response.cookie(this.config.refreshCookieName, result.refreshToken, {
      ...baseOptions,
      expires: result.sessionExpiresAt,
      httpOnly: true,
      path: '/api/v1/auth'
    });
    response.cookie(this.config.csrfCookieName, result.csrfToken, {
      ...baseOptions,
      expires: result.sessionExpiresAt,
      httpOnly: false,
      path: '/'
    });
  }

  private clearSessionCookies(response: Response): void {
    const baseOptions = {
      sameSite: 'lax' as const,
      secure: this.config.cookieSecure
    };

    response.clearCookie(this.config.accessCookieName, {
      ...baseOptions,
      httpOnly: true,
      path: '/'
    });
    response.clearCookie(this.config.refreshCookieName, {
      ...baseOptions,
      httpOnly: true,
      path: '/api/v1/auth'
    });
    response.clearCookie(this.config.csrfCookieName, {
      ...baseOptions,
      httpOnly: false,
      path: '/'
    });
  }

  private toSessionResponse(result: SessionCredentials) {
    return {
      status: result.status,
      accessExpiresAt: result.accessExpiresAt.toISOString(),
      sessionExpiresAt: result.sessionExpiresAt.toISOString(),
      user: {
        id: result.principal.userId,
        name: result.principal.name,
        email: result.principal.email,
        emailVerified: result.principal.emailVerified,
        mfaEnabled: result.principal.mfaEnabled,
        mfaVerified: result.principal.mfaVerified,
        mfaEnrollmentRequired: result.principal.mfaEnrollmentRequired,
        roles: result.principal.roles,
        permissions: result.principal.permissions
      }
    };
  }
}
