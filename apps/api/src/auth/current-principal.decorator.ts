import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const principal = context.switchToHttp().getRequest<RequestWithPrincipal>().principal;

    if (!principal) {
      throw new Error('Authenticated principal was not attached to the request.');
    }

    return principal;
  }
);
