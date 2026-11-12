import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { PixService } from '../src/modules/pix/application/pix.service';
import { createTestContext, createUser, login, type TestContext, tokenFor } from './helpers';
import { changed, openStream, receivedTopics, settle, type Stream } from './sse';

/**
 * Ciclo completo do pagamento ao vivo (DT-116, onda 3): a baixa feita pelo backend avisa o
 * pedido, o Caixa e a área da pessoa, cada um só para quem pode ver; quem compra sem conta
 * acompanha o próprio pedido pela chave assinada.
 */
describe('Pagamento confirmado chega ao vivo a quem precisa', () => {
  let ctx: TestContext;
  let base: string;
  let board: { token: string; id: string };
  let variantId: string;
  const streams: Stream[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.app.listen(0, '127.0.0.1');
    base = (await ctx.app.getUrl()).replace('[::1]', '127.0.0.1');
    board = await tokenFor(ctx, ['board']);

    const category = await ctx
      .http()
      .post('/api/v1/store/categories')
      .set(auth(board.token))
      .send({ name: `Ao vivo ${randomUUID().slice(0, 4)}` })
      .expect(201);
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Caneca ${randomUUID().slice(0, 4)}`,
        categoryId: category.body.id,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: '25.00'
      })
      .expect(201);

    variantId = product.body.variants[0].id;
    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  afterEach(() => {
    streams.splice(0).forEach((stream) => stream.close());
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const open = async (path: string, token?: string) => {
    const stream = await openStream(`${base}/api/v1/${path}`, token);

    streams.push(stream);
    await stream.waitFor((event) => event.type === 'ready', 'ready');
    await settle();
    stream.events.splice(0);

    return stream;
  };

  /** Papel personalizado só com as permissões informadas, e uma sessão completa dele. */
  async function tokenWith(permissions: string[]): Promise<string> {
    const code = `teste-pagamento-${randomUUID().slice(0, 8)}`;
    const rows = await ctx.prisma.permission.findMany({ where: { code: { in: permissions } } });

    await ctx.prisma.role.create({
      data: {
        code,
        name: `Teste ${code}`,
        rolePermissions: { create: rows.map((row) => ({ permissionId: row.id })) }
      }
    });

    const user = await createUser(ctx.prisma, [code]);

    await login(ctx, user.email);

    return login(ctx, user.email);
  }

  it('PIX pago: pedido e pagamento para quem comprou, Caixa para o financeiro, nada para os outros', async () => {
    const buyer = await tokenFor(ctx, ['user']);
    const stranger = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({ variantId, quantity: 1 })
      .expect(200);

    const orderId = (
      await ctx
        .http()
        .post('/api/v1/orders/checkout')
        .set(auth(buyer.token))
        .send({ customerPhone: '68 99999-2222', acceptTerms: true })
        .expect(201)
    ).body.order.id as string;
    const charge = await ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/pix`)
      .set(auth(buyer.token))
      .expect(200);

    const buyerStream = await open('me/events', buyer.token);
    const strangerStream = await open('me/events', stranger.token);
    const financeStream = await open('me/events', await tokenWith(['finance.read']));
    const ordersStream = await open('me/events', await tokenWith(['orders.read']));

    await ctx
      .http()
      .post(`/api/v1/me/pix/${charge.body.id}/simulate`)
      .set(auth(buyer.token))
      .expect(200);

    await buyerStream.waitFor(changed('payments'), 'payments do comprador');
    await buyerStream.waitFor(changed('orders'), 'orders do comprador');
    await financeStream.waitFor(changed('finance'), 'finance');
    await ordersStream.waitFor(changed('orders'), 'orders da loja');
    await settle();

    const strangerTopics = receivedTopics(strangerStream);

    expect(strangerTopics.has('orders')).toBe(false);
    expect(strangerTopics.has('payments')).toBe(false);
    expect(strangerTopics.has('finance')).toBe(false);
    expect(receivedTopics(ordersStream).has('finance')).toBe(false);
    expect(receivedTopics(financeStream).has('orders')).toBe(false);
  });

  it('consulta, webhook e tarefa ao mesmo tempo: baixa, lançamento e aviso uma vez só', async () => {
    const buyer = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({ variantId, quantity: 1 })
      .expect(200);

    const orderId = (
      await ctx
        .http()
        .post('/api/v1/orders/checkout')
        .set(auth(buyer.token))
        .send({ customerPhone: '68 99999-4444', acceptTerms: true })
        .expect(201)
    ).body.order.id as string;
    const charge = await ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/pix`)
      .set(auth(buyer.token))
      .expect(200);
    const pix = ctx.app.get(PixService);

    // O intermediário já recebeu: três conferências chegam juntas.
    await ctx.prisma.pixCharge.update({
      where: { id: charge.body.id as string },
      data: { simulatedPaidAt: new Date() }
    });
    await Promise.all([
      pix.sync(charge.body.id as string),
      pix.sync(charge.body.id as string),
      pix.sync(charge.body.id as string)
    ]);

    const notifications = await ctx.prisma.notification.count({ where: { userId: buyer.id } });

    await pix.sync(charge.body.id as string);

    await expect(ctx.prisma.payment.count({ where: { orderId } })).resolves.toBe(1);
    await expect(
      ctx.prisma.financialTransaction.count({ where: { payment: { orderId } } })
    ).resolves.toBe(1);
    await expect(ctx.prisma.notification.count({ where: { userId: buyer.id } })).resolves.toBe(
      notifications
    );
    expect((await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      'PAID'
    );
  });

  it('pedido sem conta: só quem tem a chave do pedido acompanha o pagamento', async () => {
    const agent = request.agent(ctx.app.getHttpServer());

    await agent.put('/api/v1/cart/items').send({ variantId, quantity: 1 }).expect(200);

    const checkout = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Visitante ao vivo',
        customerEmail: `visitante-${randomUUID().slice(0, 6)}@exemplo.test`,
        customerPhone: '68 99999-3333',
        acceptTerms: true
      })
      .expect(201);
    const guest = {
      orderNumber: checkout.body.order.orderNumber as string,
      code: checkout.body.guestAccessCode as string
    };
    const lookup = await ctx.http().post('/api/v1/public/orders/lookup').send(guest).expect(200);
    const liveKey = lookup.body.liveKey as string;

    expect(liveKey).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);

    const charge = await ctx.http().post('/api/v1/public/orders/pix').send(guest).expect(200);
    const watcher = await open(`public/live?watch=${encodeURIComponent(liveKey)}`);
    const forged = await open(`public/live?watch=${encodeURIComponent(`${liveKey}x`)}`);
    const visitor = await open('public/live');

    await ctx.http().post(`/api/v1/public/pix/${charge.body.id}/simulate`).send(guest).expect(200);

    await watcher.waitFor(changed('orders'), 'orders do pedido acompanhado');
    await settle();
    expect(receivedTopics(visitor).has('orders')).toBe(false);
    expect(receivedTopics(forged).has('orders')).toBe(false);
  });
});
