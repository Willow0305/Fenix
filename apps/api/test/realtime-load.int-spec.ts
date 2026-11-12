import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext } from './helpers';

/**
 * Carga de conexões (DT-116, onda 5): 300 visitantes conectados ao mesmo tempo, vindos de 12
 * endereços atrás do proxy, recebem a mesma mudança. Mede o tempo do commit até o último
 * receber; o resultado fica registrado em docs/14-TESTES.md.
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
});
