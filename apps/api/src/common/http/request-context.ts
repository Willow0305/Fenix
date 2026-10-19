import { randomUUID } from 'node:crypto';

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { sha256Hex } from '../crypto/tokens';

/** Identidade autenticada resolvida pelo guard a partir do access token. */
export interface Principal {
  readonly userId: string;
  readonly sessionId: string;
  readonly name: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly permissions: ReadonlySet<string>;
}

export interface RequestContext {
  requestId: string;
  principal?: Principal;
}

export type ContextRequest = Request & { fenix?: RequestContext };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Aceita `X-Request-Id` válido (UUID) ou gera um novo, e o devolve na resposta. */
export function requestIdMiddleware(req: ContextRequest, res: Response, next: NextFunction): void {
  const header = req.header('x-request-id');
  const requestId = header !== undefined && UUID_PATTERN.test(header) ? header : randomUUID();

  req.fenix = { requestId };
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function getRequestContext(req: ContextRequest): RequestContext {
  if (req.fenix === undefined) {
    req.fenix = { requestId: randomUUID() };
  }

  return req.fenix;
}

/** Metadados mínimos para auditoria: IP somente como hash. */
export interface RequestMeta {
  readonly requestId: string;
  readonly ipAddressHash: string | null;
  readonly userAgent: string | null;
}

export function getRequestMeta(req: ContextRequest): RequestMeta {
  const userAgent = req.header('user-agent');

  return {
    requestId: getRequestContext(req).requestId,
    ipAddressHash: req.ip ? sha256Hex(req.ip) : null,
    userAgent: userAgent ? userAgent.slice(0, 500) : null
  };
}

/** Injeta o principal autenticado. Use somente em rotas protegidas. */
export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const principal = getRequestContext(ctx.switchToHttp().getRequest<ContextRequest>()).principal;

  if (principal === undefined) {
    throw new Error('Principal ausente: rota protegida sem guard de autenticação.');
  }

  return principal;
});

/** Injeta o principal se houver (rotas públicas com comportamento opcional). */
export const OptionalPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    getRequestContext(ctx.switchToHttp().getRequest<ContextRequest>()).principal
);

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  getRequestMeta(ctx.switchToHttp().getRequest<ContextRequest>())
);
