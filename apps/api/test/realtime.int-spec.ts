import { randomUUID } from 'node:crypto';

import { NotificationsService } from '../src/modules/notifications/application/notifications.service';
import { createTestContext, type TestContext, tokenFor } from './helpers';

interface Stream {
  readonly events: string[];
  readonly status: number;
  readonly contentType: string | null;
  readonly waitFor: (type: string, count?: number) => Promise<void>;
  readonly close: () => void;
}

/** Abre o fluxo de eventos como o navegador: fetch com o token no cabeçalho. */
async function openStream(base: string, token: string, clientId?: string): Promise<Stream> {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/v1/me/events`, {
    headers: { Authorization: `Bearer ${token}`, ...(clientId ? { 'X-Client-Id': clientId } : {}) },
    signal: controller.signal
  });
  const events: string[] = [];
  const waiters: (() => void)[] = [];

  if (response.body) {
    void (async () => {
      const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      try {
        for (;;) {
          const { value, done } = await reader.read();

          if (done) {
            return;
          }

          buffer += value;

          let end = buffer.indexOf('\n\n');

          while (end >= 0) {
            const type = /^event: (.+)$/m.exec(buffer.slice(0, end))?.[1];

            if (type) {
              events.push(type);
              waiters.splice(0).forEach((wake) => wake());
            }

            buffer = buffer.slice(end + 2);
            end = buffer.indexOf('\n\n');
          }
        }
      } catch {
        // Conexão encerrada pelo teste.
      }
    })();
  }

  const waitFor = async (type: string, count = 1) => {
    const deadline = Date.now() + 5_000;

    while (events.filter((e) => e === type).length < count) {
      if (Date.now() > deadline) {
        throw new Error(`Evento ${type} não chegou (recebidos: ${events.join(', ')}).`);
      }

      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 200);
      });
    }
  };

  return {
    events,
    status: response.status,
    contentType: response.headers.get('content-type'),
    waitFor,
    close: () => controller.abort()
  };
}

describe('Tempo real (DT-049)', () => {
  let ctx: TestContext;
  let base: string;
  const streams: Stream[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.app.listen(0, '127.0.0.1');
    base = (await ctx.app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterEach(() => {
    streams.splice(0).forEach((stream) => stream.close());
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const open = async (token: string, clientId?: string) => {
    const stream = await openStream(base, token, clientId);

    streams.push(stream);
    await stream.waitFor('ready');

    return stream;
  };

  it('exige login', async () => {
    const response = await fetch(`${base}/api/v1/me/events`);

    expect(response.status).toBe(401);
  });

  it('abre o fluxo sem contar como uso da sessão', async () => {
    const user = await tokenFor(ctx, ['user']);
    const session = await ctx.prisma.userSession.findFirstOrThrow({ where: { userId: user.id } });
    const past = new Date(Date.now() - 10 * 60_000);

    await ctx.prisma.userSession.update({
      where: { id: session.id },
      data: { lastActivityAt: past }
    });

    const stream = await open(user.token);

    expect(stream.status).toBe(200);
    expect(stream.contentType).toContain('text/event-stream');
    expect(
      (await ctx.prisma.userSession.findUniqueOrThrow({ where: { id: session.id } })).lastActivityAt
    ).toEqual(past);
  });

  it('avisa só a pessoa que recebeu a notificação, depois do commit', async () => {
    const alice = await tokenFor(ctx, ['user']);
    const bob = await tokenFor(ctx, ['user']);
    const aliceStream = await open(alice.token);
    const bobStream = await open(bob.token);
    const notifications = ctx.app.get(NotificationsService);

    await ctx.prisma.$transaction(async (tx) => {
      await notifications.notify(
        {
          userId: alice.id,
          type: 'order.status',
          title: 'Pedido pronto',
          message: 'Retire na sede.',
          deduplicationKey: randomUUID()
        },
        tx
      );
      // Ainda dentro da transação: nada pode ter chegado.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(aliceStream.events).not.toContain('notification');
    });

    await aliceStream.waitFor('notification');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(bobStream.events).not.toContain('notification');
  });

  it('avisa a diretoria quando algo muda, sem dados e com a aba de origem', async () => {
    const board = await tokenFor(ctx, ['board']);
    const member = await tokenFor(ctx, ['user']);
    const boardStream = await open(board.token);
    const memberStream = await open(member.token);

    await ctx
      .http()
      .post('/api/v1/sport-categories')
      .set({ ...auth(board.token), 'X-Client-Id': 'aba-de-teste-1' })
      .send({ name: `Categoria ${randomUUID().slice(0, 6)}` })
      .expect(201);

    await boardStream.waitFor('changed');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(memberStream.events).not.toContain('changed');
  });

  it('login não gera aviso', async () => {
    const board = await tokenFor(ctx, ['board']);
    const stream = await open(board.token);

    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ninguem@exemplo.test', password: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(stream.events).not.toContain('changed');
  });
});
