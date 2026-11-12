import { Controller, Get, Module, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AppConfig } from '../../common/config/app-config';
import { AppError } from '../../common/errors/app-error';
import {
  type ContextRequest,
  CurrentPrincipal,
  getRequestMeta,
  type Principal
} from '../../common/http/request-context';
import {
  type RealtimeEvent,
  RealtimeService,
  type RealtimeSubscriber
} from '../../common/realtime/realtime.service';
import { Passive, Public } from '../auth/http/auth.decorators';
import { PUBLIC_REALTIME_TOPICS, visibleTopics } from './domain/topic-access';
import { verifyWatchKey, watchSecret } from './domain/watch-key';

/** A conexão fecha sozinha e o navegador reconecta com um token novo (DT-049). */
export const STREAM_LIFETIME_MS = 10 * 60_000;
const HEARTBEAT_MS = 25_000;
const MAX_STREAMS_PER_USER = 8;
const MAX_PUBLIC_STREAMS_PER_IP = 6;
const MAX_WATCHED_ORDERS = 5;

/** Pedidos das chaves válidas em `?watch=` (até 5); chave inválida é ignorada, sem erro. */
export function watchedOrders(secret: Buffer, value: unknown): Set<string> {
  const keys = typeof value === 'string' ? value.split(',').slice(0, MAX_WATCHED_ORDERS) : [];

  return new Set(
    keys.map((key) => verifyWatchKey(secret, key.trim())).filter((id): id is string => id !== null)
  );
}

export function sseFrame(event: RealtimeEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Abre o fluxo SSE e liga o assinante; tudo é desfeito quando a conexão fecha. */
function openStream(
  realtime: RealtimeService,
  req: Request,
  res: Response,
  subscriber: Omit<RealtimeSubscriber, 'send' | 'close'>
): void {
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
  const unsubscribe = realtime.subscribe({
    ...subscriber,
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

@ApiTags('Tempo real')
@Controller('me/events')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Fluxo de eventos (Server-Sent Events) da pessoa conectada. Os eventos não trazem dados:
   * a tela busca de novo pela API, com as permissões de quem está vendo. Chegam os assuntos
   * públicos e os das permissões da pessoa (DT-116). Não conta como uso da sessão.
   */
  @Get()
  @Passive()
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'text/event-stream com eventos `ready`, `notification`, `changed` e `catalog`.'
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

    openStream(this.realtime, req, res, {
      userId: principal.userId,
      permissions: principal.permissions,
      topics: visibleTopics(principal.permissions)
    });
  }
}

@ApiTags('Tempo real')
@Controller('public/live')
export class PublicRealtimeController {
  private readonly watchSecret: Buffer;

  constructor(
    private readonly realtime: RealtimeService,
    config: AppConfig
  ) {
    this.watchSecret = watchSecret(config.values.dataEncryptionKey);
  }

  /**
   * Fluxo público do site (DT-051, DT-116): avisa quando o conteúdo público muda (loja,
   * notícias, agenda, fórum…), para a página buscar de novo. Sem login e sem dados no evento.
   * O antigo `?topics=` é aceito e ignorado: todos os assuntos públicos chegam. Com
   * `?watch=`, também os avisos dos pedidos acompanhados sem login (pedido sem conta e
   * entregador), pela chave assinada que veio na consulta do pedido.
   */
  @Get()
  @Public()
  @ApiQuery({
    name: 'watch',
    required: false,
    description: 'Chaves de pedido, separadas por vírgula (até 5).'
  })
  @ApiOkResponse({ description: 'text/event-stream com eventos `ready`, `changed` e `catalog`.' })
  stream(@Query('watch') watch: unknown, @Req() req: Request, @Res() res: Response): void {
    const { ipAddressHash } = getRequestMeta(req as ContextRequest);

    if (this.realtime.publicConnectionsOf(ipAddressHash) >= MAX_PUBLIC_STREAMS_PER_IP) {
      throw new AppError(
        'TOO_MANY_REQUESTS',
        'TOO_MANY_STREAMS',
        'Muitas páginas abertas ao mesmo tempo. Feche algumas e tente de novo.'
      );
    }

    openStream(this.realtime, req, res, {
      userId: null,
      permissions: new Set(),
      topics: new Set(PUBLIC_REALTIME_TOPICS),
      watching: watchedOrders(this.watchSecret, watch),
      ipHash: ipAddressHash
    });
  }
}

@Module({
  controllers: [RealtimeController, PublicRealtimeController]
})
export class RealtimeModule {}
