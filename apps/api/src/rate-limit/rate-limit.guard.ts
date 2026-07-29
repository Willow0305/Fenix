import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';

import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { RATE_LIMIT_POLICY_KEY, type RateLimitPolicyName } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicyName>(RATE_LIMIT_POLICY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const response = context.switchToHttp().getResponse<Response>();
    const subject = request.principal?.userId ?? request.ip ?? 'unknown';
    const result = await this.rateLimits.consume(policy, subject);

    response.setHeader('RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Muitas solicitações. Aguarde antes de tentar novamente.'
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }
}
