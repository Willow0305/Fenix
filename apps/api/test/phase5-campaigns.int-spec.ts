import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, createUser, login, type TestContext, tokenFor } from './helpers';

describe('Fase 5 — remessas e campanhas', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  const hour = 3_600_000;

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Uniformes R ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Remessa aberta com um produto de duas variações. */
  async function openCampaign(
    options: { minimum?: number; maximum?: number; price?: string } = {}
  ) {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Camisa jogo ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'CAMPAIGN',
        basePrice: '120.00'
      })
      .expect(201);
    const productId = product.body.id as string;
    const withG = await ctx
      .http()
      .post(`/api/v1/store/products/${productId}/variants`)
      .set(auth(board.token))
      .send({ name: 'G', size: 'G' })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${productId}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const campaign = await ctx
      .http()
      .post('/api/v1/campaigns')
      .set(auth(board.token))
      .send({
        name: `Remessa ${randomUUID().slice(0, 5)}`,
        salesStartAt: new Date(Date.now() - hour).toISOString(),
        salesEndAt: new Date(Date.now() + 24 * hour).toISOString(),
        ...(options.minimum ? { minimumQuantity: options.minimum } : {}),
        ...(options.maximum ? { maximumQuantity: options.maximum } : {})
      })
      .expect(201);
    const id = campaign.body.id as string;

    await ctx
      .http()
      .put(`/api/v1/campaigns/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'OPEN' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${id}/products`)
      .set(auth(board.token))
      .send({ productId, campaignPrice: options.price ?? '99.90' })
      .expect(200);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'OPEN' })
      .expect(200);

    const variants = withG.body.variants as { id: string; name: string }[];

    return {
      id,
      productId,
      slug: product.body.slug as string,
      variantM: variants[0]?.id as string,
      variantG: variants[1]?.id as string
    };
  }

  async function buy(variantId: string, quantity: number, token?: string) {
    const agent = request.agent(ctx.app.getHttpServer());
    const headers = token ? auth(token) : {};

    await agent.put('/api/v1/cart/items').set(headers).send({ variantId, quantity }).expect(200);

    return agent
      .post('/api/v1/orders/checkout')
      .set(headers)
      .send({
        customerName: 'Comprador',
        customerEmail: `c-${randomUUID().slice(0, 6)}@exemplo.test`,
        customerPhone: '68 99999-3333',
        acceptTerms: true
      });
  }

  async function pay(orderId: string): Promise<void> {
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });
    const account = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `R ${randomUUID().slice(0, 5)}`, type: 'BANK' })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/store/orders/${orderId}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-19', accountId: account.body.id })
      .expect(201);
  }

  it('vende só com remessa aberta, no preço da remessa, sem estoque e até o máximo', async () => {
    const c = await openCampaign({ maximum: 3, price: '89.90' });
    const order = await buy(c.variantM, 2);

    expect(order.status).toBe(201);
    expect(order.body.order.items[0].unitPrice.amount).toBe('89.90');
    expect(order.body.order.items[0].campaign.id).toBe(c.id);
    expect((await buy(c.variantG, 2)).body.code).toBe('CAMPAIGN_FULL');

    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CLOSED' })
      .expect(200);

    const agent = request.agent(ctx.app.getHttpServer());

    expect(
      (await agent.put('/api/v1/cart/items').send({ variantId: c.variantG, quantity: 1 })).status
    ).toBe(409);
  });

  it('mantém pedido de remessa separado de produto comum', async () => {
    const c = await openCampaign();
    const regular = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Boné ${randomUUID().slice(0, 4)}`,
        categoryId,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: '40.00'
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${regular.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const agent = request.agent(ctx.app.getHttpServer());

    await agent.put('/api/v1/cart/items').send({ variantId: c.variantM, quantity: 1 }).expect(200);
    await agent
      .put('/api/v1/cart/items')
      .send({ variantId: regular.body.variants[0].id, quantity: 1 })
      .expect(200);

    const mixed = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'X Y',
        customerEmail: 'x@exemplo.test',
        customerPhone: '68 99999-0000',
        acceptTerms: true
      })
      .expect(422);

    expect(mixed.body.code).toBe('MIXED_CAMPAIGN_CART');
  });

  it('encomenda ao fornecedor só depois do mínimo pago e consolida os itens pagos', async () => {
    const c = await openCampaign({ minimum: 3 });
    const paidOrder = await buy(c.variantM, 2);
    const unpaidOrder = await buy(c.variantG, 1);

    await pay(paidOrder.body.order.id);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CLOSED' })
      .expect(200);

    const blocked = await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ORDERED' })
      .expect(409);

    expect(blocked.body.code).toBe('MINIMUM_NOT_REACHED');

    // Prazo vencido: reabrir exige novo encerramento.
    await ctx.prisma.salesCampaign.update({
      where: { id: c.id },
      data: { salesEndAt: new Date(Date.now() - 1000) }
    });
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'OPEN' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'OPEN', salesEndAt: new Date(Date.now() + 48 * hour).toISOString() })
      .expect(200);

    const third = await buy(c.variantG, 1);

    await pay(third.body.order.id);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CLOSED' })
      .expect(200);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ORDERED', date: '2026-10-20' })
      .expect(200);

    const unpaid = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: unpaidOrder.body.order.id }
    });

    expect(unpaid.status).toBe('CANCELLED');

    const report = await ctx
      .http()
      .get(`/api/v1/campaigns/${c.id}/report`)
      .set(auth(board.token))
      .expect(200);

    expect(report.body.totalQuantity).toBe(3);
    expect(
      report.body.lines.map((l: { variantName: string; quantity: number }) => [
        l.variantName,
        l.quantity
      ])
    ).toEqual([
      ['G', 1],
      ['Único', 2]
    ]);

    const csv = await ctx
      .http()
      .get(`/api/v1/campaigns/${c.id}/report.csv?kind=supplier`)
      .set(auth(board.token))
      .expect(200);

    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Produto;Variação;SKU;Quantidade');

    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/products`)
      .set(auth(board.token))
      .send({ productId: c.productId, campaignPrice: '1.00' })
      .expect(409);
  });

  it('avisa só os compradores afetados, uma vez, na chegada, e registra a retirada', async () => {
    const c = await openCampaign();
    const buyer = await createUser(ctx.prisma, ['user']);
    const token = await login(ctx, buyer.email);
    const other = await createUser(ctx.prisma, ['user']);
    const order = await buy(c.variantM, 1, token);

    await pay(order.body.order.id);

    for (const status of ['CLOSED', 'ORDERED', 'IN_PRODUCTION', 'RECEIVED']) {
      await ctx
        .http()
        .put(`/api/v1/campaigns/${c.id}/status`)
        .set(auth(board.token))
        .send({ status })
        .expect(200);
    }

    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'READY_FOR_PICKUP' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({
        status: 'READY_FOR_PICKUP',
        pickupStartsOn: '2026-11-05',
        pickupEndsOn: '2026-11-20',
        pickupInstructions: 'Ginásio, das 18h às 20h.'
      })
      .expect(200);

    const notifications = await ctx.prisma.notification.findMany({
      where: { type: 'campaign.arrived', userId: buyer.id }
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.message).toContain('05/11/2026');
    expect(
      await ctx.prisma.notification.count({ where: { type: 'campaign.arrived', userId: other.id } })
    ).toBe(0);

    const ready = await ctx
      .http()
      .get(`/api/v1/me/orders/${order.body.order.id}`)
      .set(auth(token))
      .expect(200);

    expect(ready.body.status).toBe('READY_FOR_PICKUP');

    const report = await ctx
      .http()
      .post(`/api/v1/campaigns/${c.id}/orders/${order.body.order.id}/pickup`)
      .set(auth(board.token))
      .send({ note: 'Retirado pelo próprio comprador' })
      .expect(200);

    expect(report.body.orders[0].pickedUp).toBe(true);
    await ctx
      .http()
      .post(`/api/v1/campaigns/${c.id}/orders/${order.body.order.id}/pickup`)
      .set(auth(board.token))
      .send({})
      .expect(409);
  });

  it('cancela com reembolso vinculado em cada pedido e mantém o histórico financeiro', async () => {
    const c = await openCampaign();
    const order = await buy(c.variantM, 1);

    await pay(order.body.order.id);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Fornecedor não entregou orçamento' })
      .expect(200);

    const cancelled = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: order.body.order.id },
      include: { payments: true }
    });

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.payments[0]?.status).toBe('REFUNDED');

    const entries = await ctx.prisma.financialTransaction.findMany({
      where: { payment: { orderId: cancelled.id } }
    });
    const refunds = await ctx.prisma.financialTransaction.findMany({
      where: { reversesTransactionId: entries[0]?.id ?? null }
    });

    expect(entries[0]?.status).toBe('CONFIRMED');
    expect(refunds).toHaveLength(1);
  });

  it('exclui só remessa sem pedidos; aberta ou com pedido, exige cancelar e preserva', async () => {
    const reason = { reason: 'Criada por engano' };
    const c = await openCampaign();

    const open = await ctx
      .http()
      .delete(`/api/v1/campaigns/${c.id}`)
      .set(auth(board.token))
      .send(reason)
      .expect(409);

    expect(open.body.code).toBe('CAMPAIGN_ACTIVE');

    await buy(c.variantG, 1).then((res) => expect(res.status).toBe(201));
    await ctx
      .http()
      .put(`/api/v1/campaigns/${c.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Teste de exclusão' })
      .expect(200);

    const withOrders = await ctx
      .http()
      .delete(`/api/v1/campaigns/${c.id}`)
      .set(auth(board.token))
      .send(reason)
      .expect(409);

    expect(withOrders.body.code).toBe('IN_USE');

    const draft = await ctx
      .http()
      .post('/api/v1/campaigns')
      .set(auth(board.token))
      .send({
        name: `Rascunho ${randomUUID().slice(0, 5)}`,
        salesStartAt: new Date(Date.now() + hour).toISOString(),
        salesEndAt: new Date(Date.now() + 48 * hour).toISOString()
      })
      .expect(201);

    await ctx
      .http()
      .patch(`/api/v1/campaigns/${draft.body.id}`)
      .set(auth(board.token))
      .send({ name: 'Rascunho renomeado', refundPolicy: 'Devolução integral por PIX.' })
      .expect(200)
      .then((res) => expect(res.body.name).toBe('Rascunho renomeado'));
    await ctx
      .http()
      .delete(`/api/v1/campaigns/${draft.body.id}`)
      .set(auth(board.token))
      .send(reason)
      .expect(204);
    await ctx.http().get(`/api/v1/campaigns/${draft.body.id}`).set(auth(board.token)).expect(404);

    const row = await ctx.prisma.salesCampaign.findUniqueOrThrow({
      where: { id: draft.body.id }
    });

    expect(row.deletedAt).not.toBeNull();
  });

  it('restringe a gestão de remessas', async () => {
    const user = await tokenFor(ctx, ['user']);

    await ctx.http().get('/api/v1/campaigns').set(auth(user.token)).expect(403);
    await ctx.http().get('/api/v1/public/campaigns').expect(200);
  });
});
