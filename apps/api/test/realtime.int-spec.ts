import { randomUUID } from 'node:crypto';

import { type RealtimeTopic, topicsOfPath } from '@fenix/validation';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';

import { REQUIRED_PERMISSIONS } from '../src/modules/auth/http/auth.decorators';
import { NotificationsService } from '../src/modules/notifications/application/notifications.service';
import { visibleTopics } from '../src/modules/realtime/domain/topic-access';
import { createTestContext, createUser, login, type TestContext, tokenFor } from './helpers';

interface StreamEvent {
  readonly type: string;
  readonly topics: readonly string[];
}

interface Stream {
  readonly events: StreamEvent[];
  readonly status: number;
  readonly contentType: string | null;
  readonly waitFor: (match: (event: StreamEvent) => boolean, label: string) => Promise<void>;
  readonly close: () => void;
}

/** Abre o fluxo de eventos como o navegador: fetch com o token no cabeçalho. */
async function openStream(url: string, token?: string): Promise<Stream> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal
  });
  const events: StreamEvent[] = [];
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
            const block = buffer.slice(0, end);
            const type = /^event: (.+)$/m.exec(block)?.[1];
            const data = /^data: (.+)$/m.exec(block)?.[1];

            if (type) {
              const topics = (JSON.parse(data ?? '{}') as { topics?: string[] }).topics ?? [];

              events.push({ type, topics });
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

  const waitFor = async (match: (event: StreamEvent) => boolean, label: string) => {
    const deadline = Date.now() + 5_000;

    while (!events.some(match)) {
      if (Date.now() > deadline) {
        throw new Error(`Evento ${label} não chegou (recebidos: ${JSON.stringify(events)}).`);
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

const changed = (topic: RealtimeTopic) => (event: StreamEvent) =>
  event.type === 'changed' && event.topics.includes(topic);
const receivedTopics = (stream: Stream) =>
  new Set(stream.events.filter((event) => event.type === 'changed').flatMap((e) => e.topics));
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

describe('Tempo real (DT-049, DT-116)', () => {
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

  const open = async (token?: string) => {
    const stream = await openStream(`${base}/api/v1/${token ? 'me/events' : 'public/live'}`, token);

    streams.push(stream);
    await stream.waitFor((event) => event.type === 'ready', 'ready');
    // Mudanças de antes (o cadastro do próprio teste) ainda podem estar a caminho.
    await settle();
    stream.events.splice(0);

    return stream;
  };

  /** Papel personalizado só com as permissões informadas, e uma sessão completa dele. */
  async function tokenWith(permissions: string[]): Promise<string> {
    const code = `teste-tempo-real-${randomUUID().slice(0, 8)}`;
    const rows = await ctx.prisma.permission.findMany({ where: { code: { in: permissions } } });

    expect(rows).toHaveLength(permissions.length);
    await ctx.prisma.role.create({
      data: {
        code,
        name: `Teste ${code}`,
        rolePermissions: { create: rows.map((row) => ({ permissionId: row.id })) }
      }
    });

    const user = await createUser(ctx.prisma, [code]);

    // Permissão administrativa pede a segunda etapa: o primeiro login a ativa e o segundo
    // responde ao desafio, para a sessão ter todas as permissões do papel.
    await login(ctx, user.email);

    return login(ctx, user.email);
  }

  it('exige login no fluxo da pessoa; o público abre sem login', async () => {
    expect((await fetch(`${base}/api/v1/me/events`)).status).toBe(401);

    const visitor = await open();

    expect(visitor.status).toBe(200);
    expect(visitor.contentType).toContain('text/event-stream');
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
      await settle();
      expect(aliceStream.events.map((event) => event.type)).not.toContain('notification');
    });

    await aliceStream.waitFor((event) => event.type === 'notification', 'notification');
    await settle();
    expect(bobStream.events.map((event) => event.type)).not.toContain('notification');
  });

  it('mudança pela tela avisa o assunto só a quem tem a permissão da área', async () => {
    const board = await tokenFor(ctx, ['board']);
    const member = await tokenFor(ctx, ['user']);
    const boardStream = await open(board.token);
    const memberStream = await open(member.token);

    await ctx
      .http()
      .post('/api/v1/finance/cost-centers')
      .set(auth(board.token))
      .send({ name: `Centro ${randomUUID().slice(0, 8)}` })
      .expect(201);

    await boardStream.waitFor(changed('finance'), 'finance');
    await settle();
    expect(receivedTopics(memberStream).has('finance')).toBe(false);
  });

  it('mudança feita fora de uma tela (tarefa, webhook) também avisa, só depois do commit', async () => {
    const board = await tokenFor(ctx, ['board']);
    const stream = await open(board.token);

    await ctx.prisma.$transaction(async (tx) => {
      await tx.monthlyFeePlan.create({
        data: {
          name: `Plano ${randomUUID().slice(0, 6)}`,
          amount: '50',
          currency: 'BRL',
          dueDay: 10
        }
      });
      await settle();
      expect(receivedTopics(stream).has('fees')).toBe(false);
    });

    await stream.waitFor(changed('fees'), 'fees');
  });

  it('papel personalizado recebe só as áreas das próprias permissões', async () => {
    const token = await tokenWith(['fees.read']);
    const stream = await open(token);

    await ctx.prisma.monthlyFeePlan.create({
      data: { name: `Plano ${randomUUID().slice(0, 6)}`, amount: '60', currency: 'BRL', dueDay: 5 }
    });
    await ctx.prisma.costCenter.create({
      data: { code: `cc-${randomUUID().slice(0, 8)}`, name: 'Outro centro' }
    });

    await stream.waitFor(changed('fees'), 'fees');
    await settle();
    expect(receivedTopics(stream).has('finance')).toBe(false);
  });

  it('visitante sem login recebe o conteúdo público e nada do painel', async () => {
    const visitor = await open();

    await ctx.prisma.costCenter.create({
      data: { code: `cc-${randomUUID().slice(0, 8)}`, name: 'Centro invisível' }
    });
    await ctx.prisma.productCategory.create({
      data: { name: 'Categoria ao vivo', slug: `ao-vivo-${randomUUID().slice(0, 8)}` }
    });

    await visitor.waitFor(changed('store'), 'store');
    await settle();
    expect(receivedTopics(visitor).has('finance')).toBe(false);
  });

  it('várias mudanças na mesma transação chegam num aviso só', async () => {
    const board = await tokenFor(ctx, ['board']);
    const stream = await open(board.token);

    await ctx.prisma.$transaction(async (tx) => {
      for (let i = 0; i < 5; i += 1) {
        await tx.costCenter.create({
          data: { code: `cc-${randomUUID().slice(0, 8)}`, name: `Lote ${i}` }
        });
      }
    });

    await stream.waitFor(changed('finance'), 'finance');
    await settle();
    expect(stream.events.filter(changed('finance'))).toHaveLength(1);
  });

  it('login não avisa o painel', async () => {
    const board = await tokenFor(ctx, ['board']);
    const other = await createUser(ctx.prisma, ['user']);
    const stream = await open(board.token);

    await login(ctx, other.email);
    await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ninguem@exemplo.test', password: 'x' });
    await settle();

    expect(receivedTopics(stream).has('users')).toBe(false);
  });

  it('toda tela do painel recebe aviso de pelo menos um assunto que a permissão dela vê', () => {
    const discovery = new DiscoveryService(ctx.app.get(ModulesContainer));
    // Leituras que não mudam sozinhas: conferência pontual, arquivos e configuração técnica.
    const static_ = [
      /^\/cards\/validate\//,
      /^\/media\//,
      /^\/(health|metrics)$/,
      /\/(pdf|csv|report\.csv|print|qr|file)$/,
      /\/attachments\//,
      /^\/accountability-reports\/verify\//,
      /^\/search$/,
      /^\/athletes\/:id\/guardian-declaration$/,
      /^\/permissions$/,
      /^\/audit-logs\/entity-types$/
    ];
    const missing: string[] = [];

    for (const wrapper of discovery.getControllers()) {
      const type = wrapper.metatype as (new (...args: never[]) => unknown) | null;

      if (!type) {
        continue;
      }

      const prefix = String(Reflect.getMetadata(PATH_METADATA, type) ?? '');
      const classPermissions = (Reflect.getMetadata(REQUIRED_PERMISSIONS, type) ?? []) as string[];

      for (const name of Object.getOwnPropertyNames(type.prototype)) {
        const handler = (type.prototype as Record<string, unknown>)[name];

        if (
          typeof handler !== 'function' ||
          Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.GET
        ) {
          continue;
        }

        const permissions = [
          ...classPermissions,
          ...((Reflect.getMetadata(REQUIRED_PERMISSIONS, handler) ?? []) as string[])
        ];
        const path = `/${[prefix, String(Reflect.getMetadata(PATH_METADATA, handler) ?? '')]
          .filter((part) => part !== '' && part !== '/')
          .join('/')}`;

        if (permissions.length === 0 || static_.some((pattern) => pattern.test(path))) {
          continue;
        }

        const sample = path.replace(/:[A-Za-z]+/g, '1');
        const visible = visibleTopics(new Set(permissions));

        if (!topicsOfPath(sample).some((topic) => visible.has(topic))) {
          missing.push(`${path} (${permissions.join(', ')})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
