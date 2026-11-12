import { isRealtimeTopic, type RealtimeTopic } from '@fenix/validation';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';

import { PrismaService, type PrismaTx } from '../prisma/prisma.service';

/** Canal do PostgreSQL usado para espalhar os eventos entre servidores (DT-049). */
export const REALTIME_CHANNEL = 'fenix_realtime';
/** Canal dos gatilhos do banco: cada escrita avisa o assunto que mudou (DT-116). */
export const CHANGES_CHANNEL = 'fenix_changes';
/** Junta as mudanças que chegam em sequência num aviso só por pessoa. */
export const CHANGES_COALESCE_MS = 150;

/**
 * Evento sem dados: só avisa que algo mudou, para a tela buscar de novo com as próprias
 * permissões. `changed` diz os assuntos; `catalog` avisa as páginas públicas em cache,
 * depois de o cache ser descartado (DT-051).
 */
export type RealtimeEvent =
  | { readonly type: 'notification' }
  | { readonly type: 'changed'; readonly topics: readonly RealtimeTopic[] }
  | { readonly type: 'catalog'; readonly topics: readonly PublicTopic[] };

/**
 * Assuntos das páginas públicas em cache (DT-051, DT-116): a mudança descarta o cache do site
 * e só então avisa as páginas abertas. O fórum fica de fora: as telas dele buscam direto na
 * API, e cada reação descartaria o cache do site inteiro.
 */
export const PUBLIC_TOPICS = [
  'teams',
  'tryouts',
  'store',
  'campaigns',
  'benefits',
  'partners',
  'news',
  'events',
  'settings'
] as const satisfies readonly RealtimeTopic[];
export type PublicTopic = (typeof PUBLIC_TOPICS)[number];

/** Destino: pessoas escolhidas ou quem tem uma permissão. */
export type RealtimeAudience =
  | { readonly userIds: readonly string[] }
  | { readonly permission: string }
  | { readonly topic: PublicTopic };

interface Envelope {
  readonly to: RealtimeAudience;
  readonly event: RealtimeEvent;
}

export interface RealtimeSubscriber {
  /** Nulo para visitante sem login (páginas públicas). */
  readonly userId: string | null;
  readonly permissions: ReadonlySet<string>;
  /** Assuntos que a pessoa pode receber (DT-116): os públicos e os das permissões dela. */
  readonly topics: ReadonlySet<RealtimeTopic>;
  /** Pedidos acompanhados pelo link, sem login (chave assinada, DT-116). */
  readonly watching?: ReadonlySet<string>;
  /** Hash do IP, para limitar conexões de visitantes. */
  readonly ipHash?: string | null;
  readonly send: (event: RealtimeEvent) => void;
  /** Encerra a conexão do navegador (desligamento do servidor). */
  readonly close: () => void;
}

const RECONNECT_MAX_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  if ('topic' in to) {
    return subscriber.topics.has(to.topic);
  }

  if ('userIds' in to) {
    return subscriber.userId !== null && to.userIds.includes(subscriber.userId);
  }

  return subscriber.permissions.has(to.permission);
}

/**
 * Tempo real (DT-049). Cada servidor mantém uma conexão `LISTEN` e entrega aos navegadores
 * conectados nele. Publicar dentro de uma transação só entrega depois do commit, como o
 * `NOTIFY` do PostgreSQL garante. Sem a conexão de escuta, entrega só neste servidor, e as
 * mudanças avisadas pelos gatilhos do banco (DT-116) não chegam até ela voltar.
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
  private readonly changedTopics = new Set<RealtimeTopic>();
  /** Mudanças com dono: pessoa ou pedido → assuntos. */
  private readonly ownedChanges = new Map<string, Set<RealtimeTopic>>();
  private changesTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly changeListeners = new Set<(topics: readonly RealtimeTopic[]) => void>();

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

    if (this.changesTimer) {
      clearTimeout(this.changesTimer);
    }

    await this.client?.end().catch(() => undefined);
    this.client = null;
  }

  /** Conexões públicas abertas por um IP (hash) neste servidor. */
  publicConnectionsOf(ipHash: string | null): number {
    return [...this.subscribers].filter(
      (subscriber) => subscriber.userId === null && subscriber.ipHash === ipHash
    ).length;
  }

  /** Conexões abertas da pessoa neste servidor. */
  connectionsOf(userId: string): number {
    return [...this.subscribers].filter((subscriber) => subscriber.userId === userId).length;
  }

  /** Escuta as mudanças avisadas pelo banco (assuntos sem dono), já agrupadas. */
  onChanges(listener: (topics: readonly RealtimeTopic[]) => void): () => void {
    this.changeListeners.add(listener);

    return () => {
      this.changeListeners.delete(listener);
    };
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

  /**
   * Mudança avisada por um gatilho do banco: `assunto` ou `assunto:<id>`, em que o id é a
   * pessoa dona do registro ou o pedido. As que chegam juntas viram um aviso só, e cada
   * pessoa recebe os assuntos que pode ver e os dos próprios registros.
   */
  receiveChange(payload: string): void {
    const [topic, owner, ...rest] = payload.split(':');

    if (!isRealtimeTopic(topic) || rest.length > 0) {
      return;
    }

    if (owner === undefined) {
      this.changedTopics.add(topic);
    } else if (UUID.test(owner)) {
      const key = owner.toLowerCase();
      const topics = this.ownedChanges.get(key) ?? new Set<RealtimeTopic>();

      topics.add(topic);
      this.ownedChanges.set(key, topics);
    } else {
      return;
    }

    this.changesTimer ??= setTimeout(() => this.flushChanges(), CHANGES_COALESCE_MS);
    this.changesTimer.unref();
  }

  private flushChanges(): void {
    const changed = [...this.changedTopics];
    const owned = new Map(this.ownedChanges);

    this.changesTimer = null;
    this.changedTopics.clear();
    this.ownedChanges.clear();

    if (changed.length > 0) {
      this.changeListeners.forEach((listener) => listener(changed));
    }

    for (const subscriber of this.subscribers) {
      const topics = new Set(changed.filter((topic) => subscriber.topics.has(topic)));
      const mine = [
        ...(subscriber.userId === null ? [] : [subscriber.userId.toLowerCase()]),
        ...(subscriber.watching ?? [])
      ];

      mine.forEach((key) => owned.get(key)?.forEach((topic) => topics.add(topic)));

      if (topics.size > 0) {
        subscriber.send({ type: 'changed', topics: [...topics].sort() });
      }
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
      if (!message.payload) {
        return;
      }

      if (message.channel === CHANGES_CHANNEL) {
        this.receiveChange(message.payload);

        return;
      }

      if (message.channel !== REALTIME_CHANNEL) {
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
      await client.query(`LISTEN ${CHANGES_CHANNEL}`);

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
