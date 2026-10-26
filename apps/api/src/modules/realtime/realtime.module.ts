import {
  type CallHandler,
  Controller,
  type ExecutionContext,
  Get,
  Injectable,
  Module,
  type NestInterceptor,
  Req,
  Res
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

import { AppError } from '../../common/errors/app-error';
import {
  type ContextRequest,
  CurrentPrincipal,
  type Principal
} from '../../common/http/request-context';
import { type RealtimeEvent, RealtimeService } from '../../common/realtime/realtime.service';
import { PERMISSIONS } from '../access/domain/permission-catalog';
import { Passive } from '../auth/http/auth.decorators';

/** A conexão fecha sozinha e o navegador reconecta com um token novo (DT-049). */
export const STREAM_LIFETIME_MS = 10 * 60_000;
const HEARTBEAT_MS = 25_000;
const MAX_STREAMS_PER_USER = 8;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Escritas que não interessam às listas da diretoria: login e sessão, carrinho, leitura de
 * notificações, favoritos, preferências e a própria conexão.
 */
const IGNORED_PATH =
  /^\/api\/v1\/(auth|store\/cart|me\/(notifications|favorites|events|sessions|mfa|avatar|profile-visibility|password))(\/|$)/;

const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Identificador da aba que fez a mudança (`X-Client-Id`), para ela não recarregar à toa. */
export function originOf(req: Request): string | undefined {
  const value = req.header('x-client-id');

  return value && CLIENT_ID.test(value) ? value : undefined;
}

export function sseFrame(event: RealtimeEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Depois de cada escrita bem-sucedida, avisa a diretoria conectada para atualizar as telas. */
@Injectable()
export class RealtimeChangesInterceptor implements NestInterceptor {
  constructor(private readonly realtime: RealtimeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<ContextRequest>();

    if (!MUTATING.has(req.method) || IGNORED_PATH.test(req.path)) {
      return next.handle();
    }

    const origin = originOf(req);

    return next.handle().pipe(
      tap(() => {
        void this.realtime.publish(
          { permission: PERMISSIONS.dashboardRead },
          { type: 'changed', ...(origin ? { origin } : {}) }
        );
      })
    );
  }
}

@ApiTags('Tempo real')
@ApiBearerAuth()
@Controller('me/events')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Fluxo de eventos (Server-Sent Events) da pessoa conectada. Os eventos não trazem dados:
   * a tela busca de novo pela API, com as permissões de quem está vendo. Não conta como
   * uso da sessão.
   */
  @Get()
  @Passive()
  @ApiOkResponse({
    description: 'text/event-stream com eventos `ready`, `notification` e `changed`.'
  })
  stream(
    @CurrentPrincipal() principal: Principal,
    @Req() req: Request,
    @Res() res: Response
  ): void {
    if (this.realtime.connectionsOf(principal.userId) >= MAX_STREAMS_PER_USER) {
      throw new AppError(
        'TOO_MANY_REQUESTS',
        'TOO_MANY_STREAMS',
        'Muitas abas conectadas ao mesmo tempo. Feche algumas e tente de novo.'
      );
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    // `no-transform` impede compressão no caminho, que seguraria os eventos.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const write = (chunk: string) => {
      if (!res.writableEnded) {
        res.write(chunk);
      }
    };
    const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
    const lifetime = setTimeout(() => res.end(), STREAM_LIFETIME_MS);
    const unsubscribe = this.realtime.subscribe({
      userId: principal.userId,
      permissions: principal.permissions,
      send: (event) => write(sseFrame(event)),
      close: () => res.end()
    });
    let closed = false;
    const close = () => {
      if (closed) {
        return;
      }

      closed = true;
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      unsubscribe();
    };

    req.on('close', close);
    res.on('close', close);
    write('retry: 3000\n\nevent: ready\ndata: {}\n\n');
  }
}

@Module({
  controllers: [RealtimeController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RealtimeChangesInterceptor }]
})
export class RealtimeModule {}
