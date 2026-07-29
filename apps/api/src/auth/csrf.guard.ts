import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../access-control/access.decorators';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { AuthService } from './auth.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (isPublic || SAFE_METHODS.has(request.method)) {
      return true;
    }

    if (!request.principal) {
      return false;
    }

    await this.authService.assertCsrf(request, request.principal.sessionId);

    return true;
  }
}
