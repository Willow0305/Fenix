import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';

import { createTestContext, type TestContext } from './helpers';

/**
 * Carga de conexões (DT-116, onda 5): 300 visitantes conectados ao mesmo tempo, vindos de 12
 * endereços atrás do proxy, recebem a mesma mudança. Mede o tempo do commit até o último
 * receber, a memória da API por conexão e o custo dos gatilhos no commit (PEN-078); os
 * resultados ficam registrados em docs/14-TESTES.md.
 */
const CONNECTIONS = 300;
const PER_ADDRESS = 25;

interface Listener {
  readonly received: Promise<number>;
  readonly close: () => void;
}

async function listen(base: string, address: string, since: () => number): Promise<Listener> {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/v1/public/live`, {
    headers: { 'X-Forwarded-For': address },
    signal: controller.signal
  });

  expect(response.status).toBe(200);

  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  const received = (async () => {
    let buffer = '';

    for (;;) {
      const { value, done } = await reader.read();

      if (done) {
        throw new Error('Conexão encerrada antes do aviso.');
      }

      buffer += value;

      if (/event: changed\ndata: [^\n]*"store"/.test(buffer)) {
        return Date.now() - since();
      }
    }
  })();

  received.catch(() => undefined);

  return { received, close: () => controller.abort() };
}

describe('Tempo real sob carga (DT-116)', () => {
  let ctx: TestContext;
  let base: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.app.listen(0, '127.0.0.1');
    base = (await ctx.app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it(`${CONNECTIONS} conexões recebem a mesma mudança em poucos segundos`, async () => {
    let committedAt = 0;
    const listeners: Listener[] = [];

    try {
      for (let i = 0; i < CONNECTIONS; i += 1) {
        const address = `203.0.113.${Math.floor(i / PER_ADDRESS) + 1}`;

        listeners.push(await listen(base, address, () => committedAt));
      }

      await ctx.prisma.productCategory.create({
        data: { name: 'Carga ao vivo', slug: `carga-${randomUUID().slice(0, 8)}` }
      });
      committedAt = Date.now();

      const latencies = (await Promise.all(listeners.map((l) => l.received))).sort((a, b) => a - b);
      const at = (share: number) => latencies[Math.ceil(latencies.length * share) - 1] ?? 0;

      // Registro do resultado (sem dados pessoais): copiado para docs/14-TESTES.md.
      process.stdout.write(
        `[carga] ${CONNECTIONS} conexões: p50 ${at(0.5)} ms, p95 ${at(0.95)} ms, máx ${at(1)} ms\n`
      );
      expect(latencies).toHaveLength(CONNECTIONS);
      expect(at(1)).toBeLessThan(3_000);
    } finally {
      listeners.forEach((listener) => listener.close());
    }
  }, 60_000);

  it('o limite por endereço continua valendo atrás do proxy', async () => {
    const open: AbortController[] = [];

    try {
      for (let i = 0; i < 30; i += 1) {
        const controller = new AbortController();

        open.push(controller);
        expect(
          (
            await fetch(`${base}/api/v1/public/live`, {
              headers: { 'X-Forwarded-For': '198.51.100.7' },
              signal: controller.signal
            })
          ).status
        ).toBe(200);
      }

      const refused = await fetch(`${base}/api/v1/public/live`, {
        headers: { 'X-Forwarded-For': '198.51.100.7' }
      });

      expect(refused.status).toBe(429);
    } finally {
      open.forEach((controller) => controller.abort());
    }
  });

  /**
   * Memória da API por conexão. Os clientes rodam numa thread à parte, com heap próprio, e a
   * coleta de lixo é forçada antes de cada medida (`--expose-gc`), para o número ser só o da
   * API. Sem `--expose-gc`, o teste não mede.
   */
  it('cada conexão custa pouca memória da API', async () => {
    const gc = (globalThis as { gc?: () => void }).gc;

    if (!gc) {
      return;
    }

    const total = 1_000;
    const settleHeap = async () => {
      for (let i = 0; i < 3; i += 1) {
        gc();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return process.memoryUsage().heapUsed;
    };
    const before = await settleHeap();
    const worker = new Worker(
      `
        const { parentPort, workerData } = require('node:worker_threads');
        const controllers = [];
        (async () => {
          for (let i = 0; i < workerData.total; i += 1) {
            const controller = new AbortController();
            controllers.push(controller);
            const response = await fetch(workerData.base + '/api/v1/public/live', {
              headers: { 'X-Forwarded-For': '192.0.2.' + (Math.floor(i / 25) + 1) },
              signal: controller.signal
            });
            if (response.status !== 200) { parentPort.postMessage({ error: response.status }); return; }
            response.body.getReader().read().catch(() => undefined);
          }
          parentPort.postMessage({ ready: true });
        })();
        parentPort.on('message', () => { controllers.forEach((c) => c.abort()); parentPort.postMessage({ closed: true }); });
      `,
      { eval: true, workerData: { base, total } }
    );

    try {
      const first = await new Promise<{ ready?: boolean; error?: number }>((resolve) =>
        worker.once('message', resolve)
      );

      expect(first).toEqual({ ready: true });

      const after = await settleHeap();
      const perConnection = (after - before) / total;

      process.stdout.write(
        `[carga] ${total} conexões abertas: ~${(perConnection / 1024).toFixed(1)} KiB de heap da API por conexão\n`
      );
      expect(perConnection).toBeLessThan(64 * 1024);
    } finally {
      worker.postMessage('fechar');
      await new Promise((resolve) => setTimeout(resolve, 200));
      await worker.terminate();
    }
  }, 120_000);

  /** Gravações concorrentes com e sem os gatilhos: quanto o aviso pesa no commit. */
  it('os gatilhos pesam pouco no commit de gravações concorrentes', async () => {
    const writes = 400;
    const concurrency = 10;
    const run = async () => {
      const started = Date.now();
      let next = 0;

      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (next < writes) {
            next += 1;
            await ctx.prisma.$executeRaw`
              INSERT INTO "cost_centers" ("id", "code", "name", "created_at", "updated_at")
              VALUES (gen_random_uuid(), ${`carga-${randomUUID()}`}, 'Carga', now(), now())`;
          }
        })
      );

      return Date.now() - started;
    };

    await run(); // aquece o pool de conexões
    const withTriggers = await run();

    await ctx.prisma.$executeRawUnsafe('ALTER TABLE "cost_centers" DISABLE TRIGGER USER');

    let without: number;

    try {
      without = await run();
    } finally {
      await ctx.prisma.$executeRawUnsafe('ALTER TABLE "cost_centers" ENABLE TRIGGER USER');
    }

    process.stdout.write(
      `[carga] ${writes} gravações, ${concurrency} ao mesmo tempo: ${withTriggers} ms com os gatilhos, ${without} ms sem\n`
    );
    expect(withTriggers).toBeLessThan(Math.max(without * 3, without + 2_000));
  }, 120_000);
});
