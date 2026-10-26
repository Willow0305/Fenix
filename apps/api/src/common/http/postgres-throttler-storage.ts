import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { JobScheduler } from '../jobs/job-scheduler';
import { PrismaService } from '../prisma/prisma.service';

/** O pacote não exporta o tipo do registro; é o retorno de `increment`. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const CLEANUP_INTERVAL_MS = 10 * 60_000;
const WARNING_INTERVAL_MS = 60_000;

interface BucketRow {
  readonly hits: number;
  readonly window_seconds: number;
  readonly block_seconds: number | null;
}

/**
 * Limite de requisições com contagem no PostgreSQL, compartilhada entre servidores
 * (R-04, DT-047). Mesma regra da memória do Nest: janela fixa de `ttl`; passou do limite,
 * bloqueia por `blockDuration` sem contar as tentativas seguintes; vencido o bloqueio,
 * a contagem recomeça. Uma única instrução atômica por requisição.
 *
 * Se o banco falhar, conta na memória do processo até ele voltar, para o site não cair
 * junto (os limites voltam a ser por servidor nesse intervalo, e isso fica no log).
 */
@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage, OnModuleInit {
  private readonly logger = new Logger('LimiteDeRequisicoes');
  private readonly fallback = new ThrottlerStorageService();
  private lastWarningAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobScheduler
  ) {}

  onModuleInit(): void {
    this.jobs.every('rate-limit.cleanup', CLEANUP_INTERVAL_MS, () => this.cleanup());
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await this.incrementShared(`${throttlerName}:${key}`, ttl, limit, blockDuration);
    } catch (error) {
      this.warn(error);

      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  /** Apaga contagens vencidas e sem bloqueio ativo. */
  async cleanup(): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM "rate_limit_buckets"
      WHERE "window_ends_at" < now()
        AND ("blocked_until" IS NULL OR "blocked_until" < now())`;
  }

  private async incrementShared(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number
  ): Promise<ThrottlerStorageRecord> {
    const ttlMs = Math.max(1, ttl);
    const blockMs = Math.max(1, blockDuration);
    // "b" é a linha atual; os CASE usam os valores anteriores à atualização:
    // - bloqueio ativo: nada muda;
    // - bloqueio vencido ou janela vencida: recomeça em 1, com janela nova;
    // - senão: soma 1 e, se passar do limite, bloqueia.
    const rows = await this.prisma.$queryRaw<BucketRow[]>`
      INSERT INTO "rate_limit_buckets" AS b ("id", "key", "hits", "window_ends_at", "blocked_until")
      VALUES (
        gen_random_uuid(), ${key}, 1,
        now() + ${ttlMs}::double precision * interval '1 millisecond',
        CASE WHEN 1 > ${limit}::integer
          THEN now() + ${blockMs}::double precision * interval '1 millisecond' END
      )
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE
          WHEN b."blocked_until" > now() THEN b."hits"
          WHEN b."blocked_until" IS NOT NULL OR b."window_ends_at" <= now() THEN 1
          ELSE b."hits" + 1
        END,
        "window_ends_at" = CASE
          WHEN b."blocked_until" > now() THEN b."window_ends_at"
          WHEN b."blocked_until" IS NOT NULL OR b."window_ends_at" <= now()
            THEN now() + ${ttlMs}::double precision * interval '1 millisecond'
          ELSE b."window_ends_at"
        END,
        "blocked_until" = CASE
          WHEN b."blocked_until" > now() THEN b."blocked_until"
          WHEN b."blocked_until" IS NOT NULL OR b."window_ends_at" <= now() THEN
            CASE WHEN 1 > ${limit}::integer
              THEN now() + ${blockMs}::double precision * interval '1 millisecond' END
          WHEN b."hits" + 1 > ${limit}::integer
            THEN now() + ${blockMs}::double precision * interval '1 millisecond'
          ELSE NULL
        END
      RETURNING
        "hits",
        ceil(extract(epoch FROM ("window_ends_at" - now())))::integer AS window_seconds,
        ceil(extract(epoch FROM ("blocked_until" - now())))::integer AS block_seconds`;
    const row = rows[0];

    if (!row) {
      throw new Error('O banco não devolveu a contagem do limite de requisições.');
    }

    const blockSeconds = row.block_seconds ?? 0;

    return {
      totalHits: row.hits,
      timeToExpire: Math.max(0, row.window_seconds),
      isBlocked: blockSeconds > 0,
      timeToBlockExpire: Math.max(0, blockSeconds)
    };
  }

  private warn(error: unknown): void {
    const now = Date.now();

    if (now - this.lastWarningAt < WARNING_INTERVAL_MS) {
      return;
    }

    this.lastWarningAt = now;
    this.logger.warn(
      `Contagem compartilhada indisponível; usando a memória deste servidor. ${
        error instanceof Error ? error.name : 'Erro desconhecido'
      }.`
    );
  }
}
