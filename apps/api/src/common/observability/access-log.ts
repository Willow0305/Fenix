import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { getRequestContext } from '../http/request-context';
import { metrics } from './metrics';

const logger = new Logger('Acesso');

/** Modelo da rota (`/api/v1/store/orders/:id`); sem casar com nenhuma, "não encontrada". */
export function routeOf(req: Request): string {
  const route = (req as Request & { route?: { path?: string } }).route?.path;

  return route ? `${req.baseUrl}${route}` : 'nao-encontrada';
}

/**
 * Registro de acesso e métricas por requisição (R-07): método, modelo da rota, situação,
 * duração e requestId. Nunca o endereço completo (ids, busca) nem dados de quem chamou.
 */
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const route = routeOf(req);

    metrics.observe(req.method, route, res.statusCode, seconds);

    if (process.env['ACCESS_LOG'] !== 'off') {
      logger.log({
        msg: 'requisição',
        requestId: getRequestContext(req as never).requestId,
        method: req.method,
        route,
        status: res.statusCode,
        ms: Math.round(seconds * 1000)
      });
    }
  });

  next();
}
