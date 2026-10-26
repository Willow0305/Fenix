import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type JobTask = () => Promise<unknown>;

/** Tipo do erro, sem a mensagem, que pode citar dados pessoais (`AGENTS.md`). */
export function jobErrorLabel(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Erro desconhecido';
  }

  const code = (error as { code?: unknown }).code;

  return (typeof code === 'string' ? `${error.name} (${code})` : error.name).slice(0, 200);
}

/** Pilha de chamadas sem a primeira linha, que repete a mensagem do erro. */
export function jobErrorTrace(error: unknown): string | undefined {
  return error instanceof Error ? error.stack?.split('\n').slice(1).join('\n') : undefined;
}

/** Tarefas desligadas em testes e por configuração (`SCHEDULED_JOBS=off`). */
export function scheduledJobsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env['NODE_ENV'] !== 'test' &&
    env['SCHEDULED_JOBS'] !== 'off' &&
    // Nome antigo, mantido para não religar tarefas em ambientes já configurados.
    env['ORDER_EXPIRY_JOB'] !== 'off'
  );
}

/**
 * Tarefas automáticas com concessão no PostgreSQL (R-04, DT-047). Com vários servidores,
 * cada tarefa roda em um só deles por intervalo: quem consegue a concessão a mantém até o
 * fim do intervalo, mesmo terminando antes. Se o servidor cair no meio, a concessão vence
 * e outro assume na rodada seguinte.
 */
@Injectable()
export class JobScheduler implements OnApplicationShutdown {
  private readonly logger = new Logger('Tarefas');
  private readonly timers = new Set<ReturnType<typeof setInterval>>();
  readonly holder = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`.slice(0, 160);

  constructor(private readonly prisma: PrismaService) {}

  /** Agenda `task` a cada `intervalMs`; não faz nada com as tarefas desligadas. */
  every(name: string, intervalMs: number, task: JobTask): void {
    if (!scheduledJobsEnabled()) {
      return;
    }

    const timer = setInterval(() => void this.runExclusive(name, intervalMs, task), intervalMs);

    timer.unref();
    this.timers.add(timer);
  }

  /**
   * Roda `task` se nenhum servidor tiver a concessão de `name`. A concessão dura um pouco
   * menos que o intervalo, para o próprio servidor conseguir renová-la na rodada seguinte.
   * Nunca lança erro: falhas são registradas no log e na concessão.
   */
  async runExclusive(name: string, intervalMs: number, task: JobTask): Promise<boolean> {
    let acquired: boolean;

    try {
      acquired = await this.acquire(name, Math.max(1_000, Math.floor(intervalMs * 0.9)));
    } catch (error) {
      this.logger.error(`Não foi possível reservar a tarefa ${name}: ${jobErrorLabel(error)}.`);

      return false;
    }

    if (!acquired) {
      return false;
    }

    try {
      await task();
      await this.finish(name, 'SUCCEEDED', null);
    } catch (error) {
      this.logger.error(`A tarefa ${name} falhou: ${jobErrorLabel(error)}.`, jobErrorTrace(error));
      await this.finish(name, 'FAILED', jobErrorLabel(error)).catch(() => undefined);
    }

    return true;
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }

    this.timers.clear();
  }

  private async acquire(name: string, leaseMs: number): Promise<boolean> {
    // Inserção ou atualização atômica: só vence quem encontrar a concessão já vencida.
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "scheduled_job_leases"
        ("id", "name", "holder", "locked_until", "last_started_at", "updated_at")
      VALUES (
        gen_random_uuid(), ${name}, ${this.holder},
        now() + ${leaseMs}::double precision * interval '1 millisecond', now(), now()
      )
      ON CONFLICT ("name") DO UPDATE SET
        "holder" = EXCLUDED."holder",
        "locked_until" = EXCLUDED."locked_until",
        "last_started_at" = EXCLUDED."last_started_at",
        "updated_at" = EXCLUDED."updated_at"
      WHERE "scheduled_job_leases"."locked_until" <= now()
      RETURNING "id"`;

    return rows.length > 0;
  }

  private async finish(
    name: string,
    status: 'SUCCEEDED' | 'FAILED',
    error: string | null
  ): Promise<void> {
    await this.prisma.scheduledJobLease.updateMany({
      where: { name, holder: this.holder },
      data: {
        lastFinishedAt: new Date(),
        lastStatus: status,
        lastError: error,
        updatedAt: new Date()
      }
    });
  }
}
