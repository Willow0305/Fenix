import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../access-control/access.decorators';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly config: AuthConfig
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const accessToken = this.authService.readCookie(request, this.config.accessCookieName);

    request.principal = await this.authService.authenticateAccessToken(accessToken);

    return true;
  }
}
