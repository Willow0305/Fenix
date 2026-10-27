import { timingSafeEqual } from 'node:crypto';

import { Controller, Get, Headers, Header, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { metrics } from '../common/observability/metrics';
import { Public } from '../modules/auth/http/auth.decorators';

/**
 * Métricas Prometheus (R-07). Só respondem com `METRICS_TOKEN` definido e o mesmo valor em
 * `Authorization: Bearer`; sem token configurado, a rota nem existe (404).
 */
@ApiExcludeController()
@Public()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  get(@Headers('authorization') authorization: string | undefined): string {
    const expected = process.env['METRICS_TOKEN'];
    const given = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

    if (
      !expected ||
      given.length !== expected.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      throw new NotFoundException();
    }

    return metrics.render();
  }
}
