import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import type { RequestWithPrincipal } from './request-with-principal';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  public use(request: RequestWithPrincipal, response: Response, next: NextFunction): void {
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && UUID_PATTERN.test(suppliedRequestId) ? suppliedRequestId : randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
