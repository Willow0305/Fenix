import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';

import { PrismaService, type PrismaTx } from '../prisma/prisma.service';

/** Canal do PostgreSQL usado para espalhar os eventos entre servidores (DT-049). */
export const REALTIME_CHANNEL = 'fenix_realtime';

/**
 * Evento sem dados: só avisa que algo mudou, para a tela buscar de novo com as próprias
 * permissões. `origin` identifica a aba que fez a mudança, que não precisa recarregar.
 */
export interface RealtimeEvent {
  readonly type: 'notification' | 'changed';
  readonly origin?: string;
}

/** Destino: pessoas escolhidas ou quem tem uma permissão. */
export type RealtimeAudience =
  { readonly userIds: readonly string[] } | { readonly permission: string };

interface Envelope {
  readonly to: RealtimeAudience;
  readonly event: RealtimeEvent;
}

export interface RealtimeSubscriber {
  readonly userId: string;
  readonly permissions: ReadonlySet<string>;
  readonly send: (event: RealtimeEvent) => void;
  /** Encerra a conexão do navegador (desligamento do servidor). */
  readonly close: () => void;
}

const RECONNECT_MAX_MS = 30_000;
/** O NOTIFY aceita até 8000 bytes; 100 UUIDs cabem com folga. */
const USERS_PER_EVENT = 100;

/** Divide listas grandes de pessoas em vários envelopes. */
export function envelopes(audiences: readonly RealtimeAudience[]): RealtimeAudience[] {
  return audiences.flatMap((audience) => {
    if (!('userIds' in audience)) {
      return [audience];
    }

    const chunks: RealtimeAudience[] = [];

    for (let i = 0; i < audience.userIds.length; i += USERS_PER_EVENT) {
      chunks.push({ userIds: audience.userIds.slice(i, i + USERS_PER_EVENT) });
    }

    return chunks;
  });
}

/** Endereço para o `pg`: sem os parâmetros próprios do Prisma (`schema`, limites do pool). */
export function listenerUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get('sslmode');

  url.search = sslmode ? `?sslmode=${sslmode}` : '';

  return url.toString();
}

export function matches(subscriber: RealtimeSubscriber, to: RealtimeAudience): boolean {
  return 'userIds' in to
    ? to.userIds.includes(subscriber.userId)
    : subscriber.permissions.has(to.permission);
}

/**
 * Tempo real (DT-049). Cada servidor mantém uma conexão `LISTEN` e entrega aos navegadores
 * conectados nele. Publicar dentro de uma transação só entrega depois do commit, como o
 * `NOTIFY` do PostgreSQL garante. Sem a conexão de escuta, entrega só neste servidor.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('TempoReal');
  private readonly subscribers = new Set<RealtimeSubscriber>();
  private client: Client | null = null;
  private listening = false;
  private stopped = false;
  private retryMs = 1_000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env['REALTIME'] === 'off') {
      return;
    }

    void this.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;

    for (const subscriber of [...this.subscribers]) {
      subscriber.close();
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    await this.client?.end().catch(() => undefined);
    this.client = null;
  }

  /** Conexões abertas da pessoa neste servidor. */
  connectionsOf(userId: string): number {
    return [...this.subscribers].filter((subscriber) => subscriber.userId === userId).length;
  }

  subscribe(subscriber: RealtimeSubscriber): () => void {
    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /** Publica para outros servidores e para este. Falha de publicação nunca derruba a ação. */
  async publish(
    to: RealtimeAudience | readonly RealtimeAudience[],
    event: RealtimeEvent,
    tx?: PrismaTx
  ): Promise<void> {
    const audiences = envelopes(Array.isArray(to) ? to : [to as RealtimeAudience]);

    if (audiences.length === 0) {
      return;
    }

    if (!this.listening) {
      // Sem escuta não há como receber o NOTIFY: entrega direto aos conectados aqui.
      audiences.forEach((audience) => this.dispatch({ to: audience, event }));

      return;
    }

    try {
      for (const audience of audiences) {
        const payload = JSON.stringify({ to: audience, event } satisfies Envelope);

        await (tx ?? this.prisma).$executeRaw`SELECT pg_notify(${REALTIME_CHANNEL}, ${payload})`;
      }
    } catch (error) {
      this.logger.warn(`Evento não publicado: ${(error as Error).name}.`);
    }
  }

  private dispatch(envelope: Envelope): void {
    for (const subscriber of this.subscribers) {
      if (matches(subscriber, envelope.to)) {
        subscriber.send(envelope.event);
      }
    }
  }

  private async connect(): Promise<void> {
    const databaseUrl = process.env['REALTIME_DATABASE_URL'] ?? process.env['DATABASE_URL'];

    if (!databaseUrl || this.stopped) {
      return;
    }

    const client = new Client({ connectionString: listenerUrl(databaseUrl) });

    client.on('notification', (message) => {
      if (message.channel !== REALTIME_CHANNEL || !message.payload) {
        return;
      }

      try {
        this.dispatch(JSON.parse(message.payload) as Envelope);
      } catch {
        this.logger.warn('Evento malformado ignorado.');
      }
    });
    client.on('error', () => this.reconnect(client));
    client.on('end', () => this.reconnect(client));

    // Guardada antes de conectar: um desligamento no meio da conexão também a encerra.
    this.client = client;

    try {
      await client.connect();
      await client.query(`LISTEN ${REALTIME_CHANNEL}`);

      if (this.stopped) {
        await client.end().catch(() => undefined);

        return;
      }

      this.listening = true;
      this.retryMs = 1_000;
    } catch (error) {
      if (this.stopped) {
        return;
      }

      this.logger.warn(`Escuta indisponível: ${(error as Error).name}. Nova tentativa em breve.`);
      this.reconnect(client);
    }
  }

  private reconnect(client: Client): void {
    if (this.client === client) {
      this.client = null;
    }

    this.listening = false;
    void client.end().catch(() => undefined);

    if (this.stopped || this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, this.retryMs);
    this.retryTimer.unref();
    this.retryMs = Math.min(this.retryMs * 2, RECONNECT_MAX_MS);
  }
}
