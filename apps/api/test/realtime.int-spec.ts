import { randomUUID } from 'node:crypto';

import { topicsOfPath } from '@fenix/validation';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';

import { REQUIRED_PERMISSIONS } from '../src/modules/auth/http/auth.decorators';
import { CampaignsService } from '../src/modules/campaigns/application/campaigns.service';
import { NotificationsService } from '../src/modules/notifications/application/notifications.service';
import { visibleTopics } from '../src/modules/realtime/domain/topic-access';
import { createTestContext, createUser, login, type TestContext, tokenFor } from './helpers';
import { changed, openStream, receivedTopics, settle, type Stream } from './sse';

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

  it('tarefa automática avisa: remessa fechada pelo prazo chega à equipe e ao visitante', async () => {
    const slug = `remessa-${randomUUID().slice(0, 8)}`;

    await ctx.prisma.salesCampaign.create({
      data: {
        name: 'Remessa vencida',
        slug,
        status: 'OPEN',
        salesStartAt: new Date(Date.now() - 3 * 86_400_000),
        salesEndAt: new Date(Date.now() - 60_000),
        currency: 'BRL'
      }
    });

    const staff = await open(await tokenWith(['campaigns.manage']));
    const visitor = await open();

    expect(await ctx.app.get(CampaignsService).closeExpired()).toBeGreaterThanOrEqual(1);
    await staff.waitFor(changed('campaigns'), 'campaigns');
    await visitor.waitFor(changed('campaigns'), 'campaigns');
    expect((await ctx.prisma.salesCampaign.findUniqueOrThrow({ where: { slug } })).status).toBe(
      'CLOSED'
    );
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

  it('mudança pública fora de uma tela também atualiza as páginas em cache (catalog)', async () => {
    const visitor = await open();

    await ctx.prisma.productCategory.create({
      data: { name: 'Categoria em cache', slug: `cache-${randomUUID().slice(0, 8)}` }
    });

    await visitor.waitFor(
      (event) => event.type === 'catalog' && event.topics.includes('store'),
      'catalog da loja'
    );
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
