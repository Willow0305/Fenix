import { randomUUID } from 'node:crypto';

import request from 'supertest';

import {
  createTestContext,
  createUser,
  login,
  PNG_1X1,
  type TestContext,
  tokenFor
} from './helpers';

describe('Fase 4 — loja, estoque, carrinho e pedidos', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    const category = await ctx
      .http()
      .post('/api/v1/store/categories')
      .set(auth(board.token))
      .send({ name: `Uniformes ${randomUUID().slice(0, 4)}` })
      .expect(201);

    categoryId = category.body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Produto ativo com uma variação e estoque inicial. */
  async function product(
    options: { price?: string; stock?: number; buyerLimit?: number; fulfillmentType?: string } = {}
  ) {
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Camisa ${randomUUID().slice(0, 6)}`,
        categoryId,
        fulfillmentType: options.fulfillmentType ?? 'STOCK',
        basePrice: options.price ?? '89.90',
        ...(options.buyerLimit ? { buyerLimit: options.buyerLimit } : {})
      })
      .expect(201);
    const variantId = created.body.variants[0].id as string;

    if (options.stock !== undefined && options.stock > 0) {
      await ctx
        .http()
        .post(`/api/v1/store/variants/${variantId}/stock`)
        .set(auth(board.token))
        .send({ type: 'STOCK_IN', quantity: options.stock, reason: 'Entrada inicial' })
        .expect(201);
    }

    await ctx
      .http()
      .put(`/api/v1/store/products/${created.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return { id: created.body.id as string, slug: created.body.slug as string, variantId };
  }

  /** Agente HTTP com cookies (carrinho de visitante). */
  function guest() {
    return request.agent(ctx.app.getHttpServer());
  }

  async function accountId(): Promise<string> {
    const res = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Loja ${randomUUID().slice(0, 6)}`, type: 'BANK' })
      .expect(201);

    return res.body.id as string;
  }

  async function pix(): Promise<string> {
    return (await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } })).id;
  }

  async function stockOf(variantId: string): Promise<number> {
    const detail = await ctx.prisma.inventoryMovement.aggregate({
      where: { productVariantId: variantId },
      _sum: { quantityDelta: true }
    });

    return detail._sum.quantityDelta ?? 0;
  }

  const customer = {
    customerName: 'Visitante Teste',
    customerEmail: 'visitante@exemplo.test',
    customerPhone: '68 99999-2222',
    acceptTerms: true
  };

  it('cupom por produto e público: prévia, uso, limite e liberação ao cancelar (DT-045)', async () => {
    const camisa = await product({ price: '100.00', stock: 5 });
    const bone = await product({ price: '50.00', stock: 5 });
    const athleteRole = await ctx.prisma.role.findUniqueOrThrow({ where: { code: 'athlete' } });
    const code = `ATLETA${randomUUID().slice(0, 4).toUpperCase()}`;
    const coupon = await ctx
      .http()
      .post('/api/v1/store/coupons')
      .set(auth(board.token))
      .send({
        code: code.toLowerCase(),
        discountType: 'PERCENTAGE',
        percentage: '20',
        scope: 'PRODUCTS',
        productIds: [camisa.id],
        audience: 'ROLES',
        roleIds: [athleteRole.id],
        maxPerCustomer: 1
      })
      .expect(201);

    expect(coupon.body.code).toBe(code);

    const fill = async (token?: string) => {
      for (const variantId of [camisa.variantId, bone.variantId]) {
        const req = ctx.http().put('/api/v1/cart/items');

        await (token ? req.set(auth(token)) : req).send({ variantId, quantity: 1 }).expect(200);
      }
    };
    const preview = (token: string | null, agent = ctx.http()) => {
      const req = agent.post('/api/v1/cart/coupon');

      return (token ? req.set(auth(token)) : req).send({ code });
    };

    // Visitante precisa entrar; conta comum não é do público do cupom.
    const visitor = guest();

    await visitor
      .put('/api/v1/cart/items')
      .send({ variantId: bone.variantId, quantity: 1 })
      .expect(200);
    expect((await preview(null, visitor).expect(422)).body.errors[0].code).toBe('LOGIN_REQUIRED');

    const common = await tokenFor(ctx, ['user']);

    await fill(common.token);
    expect((await preview(common.token).expect(422)).body.errors[0].code).toBe('AUDIENCE');

    // Atleta: 20% só na camisa.
    const athlete = await tokenFor(ctx, ['user', 'athlete']);

    await fill(athlete.token);

    const shown = await preview(athlete.token).expect(200);

    expect(shown.body).toEqual(
      expect.objectContaining({
        discount: expect.objectContaining({ amount: '20.00' }),
        total: expect.objectContaining({ amount: '130.00' })
      })
    );

    const checkout = (couponCode: string) =>
      ctx
        .http()
        .post('/api/v1/orders/checkout')
        .set(auth(athlete.token))
        .send({ acceptTerms: true, customerPhone: '68 98888-3333', couponCode });
    const first = await checkout(code.toLowerCase()).expect(201);
    const order = first.body.order;

    expect(order.subtotalAmount.amount).toBe('150.00');
    expect(order.discountAmount.amount).toBe('20.00');
    expect(order.totalAmount.amount).toBe('130.00');
    expect(order.coupon).toEqual({ code, released: false });
    expect(
      order.items.find((i: { productId: string }) => i.productId === camisa.id).discountAmount
        .amount
    ).toBe('20.00');

    // Limite de 1 uso por pessoa.
    await fill(athlete.token);
    expect((await checkout(code).expect(422)).body.errors[0].code).toBe('CUSTOMER_LIMIT');

    // Pedido cancelado libera o uso.
    await ctx
      .http()
      .put(`/api/v1/store/orders/${order.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Teste de cupom' })
      .expect(200);
    await preview(athlete.token).expect(200);

    // Cupom com histórico não é excluído: só inativado.
    await ctx
      .http()
      .delete(`/api/v1/store/coupons/${coupon.body.id}`)
      .set(auth(board.token))
      .send({ reason: 'Teste' })
      .expect(409);
    await ctx
      .http()
      .put(`/api/v1/store/coupons/${coupon.body.id}/active`)
      .set(auth(board.token))
      .send({ isActive: false })
      .expect(200);
    expect((await preview(athlete.token).expect(422)).body.errors[0].code).toBe('INACTIVE');

    const list = await ctx.http().get('/api/v1/store/coupons').set(auth(board.token)).expect(200);

    expect(list.body.find((c: { id: string }) => c.id === coupon.body.id).redemptions).toBe(0);
    await ctx.http().get('/api/v1/store/coupons').set(auth(common.token)).expect(403);
  });

  it('shows only active products publicly and hides cost', async () => {
    const draft = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Rascunho ${randomUUID().slice(0, 4)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '10.00',
        costPrice: '4.00'
      })
      .expect(201);
    const active = await product({ stock: 3 });

    await ctx.http().get(`/api/v1/public/products/${draft.body.slug}`).expect(404);

    const pub = await ctx.http().get(`/api/v1/public/products/${active.slug}`).expect(200);

    expect(pub.body.purchasable).toBe(true);
    expect(pub.body.variants[0].stock).toBeNull();
    expect(JSON.stringify(pub.body)).not.toContain('costPrice');
    await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth((await tokenFor(ctx, ['user'])).token))
      .send({})
      .expect(403);
  });

  it('guest checkout reserves stock, freezes price and allows lookup only with the code', async () => {
    const p = await product({ price: '50.00', stock: 5 });
    const agent = guest();

    await agent.put('/api/v1/cart/items').send({ variantId: p.variantId, quantity: 6 }).expect(409);

    const cart = await agent
      .put('/api/v1/cart/items')
      .send({ variantId: p.variantId, quantity: 2 })
      .expect(200);

    expect(cart.body.total.amount).toBe('100.00');

    await agent
      .post('/api/v1/orders/checkout')
      .send({ ...customer, acceptTerms: false })
      .expect(422);

    const checkout = await agent.post('/api/v1/orders/checkout').send(customer).expect(201);
    const order = checkout.body.order;

    expect(order.status).toBe('AWAITING_PAYMENT');
    expect(order.totalAmount.amount).toBe('100.00');
    expect(checkout.body.guestAccessCode).toEqual(expect.any(String));
    expect(await stockOf(p.variantId)).toBe(3);

    // Mudança de preço posterior não altera o pedido.
    await ctx
      .http()
      .patch(`/api/v1/store/products/${p.id}`)
      .set(auth(board.token))
      .send({ basePrice: '70.00' })
      .expect(200);

    const looked = await ctx
      .http()
      .post('/api/v1/public/orders/lookup')
      .send({ orderNumber: order.orderNumber, code: checkout.body.guestAccessCode })
      .expect(200);

    expect(looked.body.items[0].unitPrice.amount).toBe('50.00');
    await ctx
      .http()
      .post('/api/v1/public/orders/lookup')
      .send({ orderNumber: order.orderNumber, code: 'codigo-errado-123' })
      .expect(404);

    const emptyCart = await agent.get('/api/v1/cart').expect(200);

    expect(emptyCart.body.lines).toHaveLength(0);
  });

  it('never oversells under concurrent checkouts', async () => {
    const p = await product({ stock: 1 });
    const agents = [guest(), guest(), guest()];

    for (const agent of agents) {
      await agent
        .put('/api/v1/cart/items')
        .send({ variantId: p.variantId, quantity: 1 })
        .expect(200);
    }

    const results = await Promise.all(
      agents.map((agent) => agent.post('/api/v1/orders/checkout').send(customer))
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await stockOf(p.variantId)).toBe(0);
  });

  it('confirms payment once, converts the reservation and posts the sale to the cash', async () => {
    const p = await product({ price: '30.00', stock: 4 });
    const buyer = await createUser(ctx.prisma, ['user']);
    const token = await login(ctx, buyer.email);
    const account = await accountId();

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(token))
      .send({ variantId: p.variantId, quantity: 2 })
      .expect(200);

    const { body } = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(token))
      .send({ acceptTerms: true, customerPhone: '68 98888-1111' })
      .expect(201);
    const orderId = body.order.id as string;

    expect(body.order.customerEmail).toBe(buyer.email);

    const proof = await ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/proof`)
      .set(auth(token))
      .set(key())
      .field('paidOn', '2026-10-18')
      .attach('file', PNG_1X1, 'pix.png')
      .expect(201);
    const paymentId = proof.body.payments[0].id as string;

    await ctx
      .http()
      .post(`/api/v1/store/orders/${orderId}/payments/${paymentId}/confirm`)
      .set(auth(board.token))
      .send({ accountId: account })
      .expect(200);
    const again = await ctx
      .http()
      .post(`/api/v1/store/orders/${orderId}/payments/${paymentId}/confirm`)
      .set(auth(board.token))
      .send({ accountId: account })
      .expect(200);

    expect(again.body.status).toBe('PAID');
    expect(
      await ctx.prisma.financialTransaction.count({
        where: { paymentId, origin: 'ORDER', status: 'CONFIRMED' }
      })
    ).toBe(1);
    expect(await stockOf(p.variantId)).toBe(2);

    const types = await ctx.prisma.inventoryMovement.findMany({
      where: { orderItem: { orderId } },
      select: { type: true }
    });

    expect(types.map((t) => t.type).sort()).toEqual(['RELEASE', 'RESERVATION', 'STOCK_OUT']);

    const notifications = await ctx
      .http()
      .get('/api/v1/me/notifications')
      .set(auth(token))
      .expect(200);

    expect(notifications.body.data.map((n: { type: string }) => n.type)).toEqual(
      expect.arrayContaining(['order.created', 'order.paid'])
    );
  });

  it('cancels a paid order with a linked refund and returns stock', async () => {
    const p = await product({ price: '40.00', stock: 2 });
    const account = await accountId();
    const agent = guest();

    await agent.put('/api/v1/cart/items').send({ variantId: p.variantId, quantity: 1 }).expect(200);

    const { body } = await agent.post('/api/v1/orders/checkout').send(customer).expect(201);
    const orderId = body.order.id as string;

    await ctx
      .http()
      .post(`/api/v1/store/orders/${orderId}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: await pix(), paidOn: '2026-10-18', accountId: account })
      .expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${orderId}/status`)
      .set(auth(board.token))
      .send({ status: 'READY_FOR_PICKUP' })
      .expect(200);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${orderId}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED' })
      .expect(422);

    const cancelled = await ctx
      .http()
      .put(`/api/v1/store/orders/${orderId}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Cliente desistiu antes da retirada', restock: true })
      .expect(200);

    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.payments[0].status).toBe('REFUNDED');
    expect(await stockOf(p.variantId)).toBe(2);

    const sum = await ctx.prisma.financialTransaction.groupBy({
      by: ['direction'],
      where: { accountId: account, status: 'CONFIRMED' },
      _sum: { amount: true }
    });

    expect(sum.find((s) => s.direction === 'INCOME')?._sum.amount?.toFixed(2)).toBe('40.00');
    expect(sum.find((s) => s.direction === 'EXPENSE')?._sum.amount?.toFixed(2)).toBe('40.00');
    await ctx
      .http()
      .put(`/api/v1/store/orders/${orderId}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(409);
  });

  it('enforces buyer limits across orders and expires unpaid reservations', async () => {
    const p = await product({ stock: 10, buyerLimit: 2 });
    const buyer = await createUser(ctx.prisma, ['user']);
    const token = await login(ctx, buyer.email);

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(token))
      .send({ variantId: p.variantId, quantity: 3 })
      .expect(422);
    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(token))
      .send({ variantId: p.variantId, quantity: 2 })
      .expect(200);

    const first = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(token))
      .send({ acceptTerms: true, customerPhone: '68 98888-1111' })
      .expect(201);

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(token))
      .send({ variantId: p.variantId, quantity: 1 })
      .expect(200);
    const limited = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(token))
      .send({ acceptTerms: true, customerPhone: '68 98888-1111' })
      .expect(409);

    expect(limited.body.code).toBe('BUYER_LIMIT');
    expect(await stockOf(p.variantId)).toBe(8);

    await ctx.prisma.order.update({
      where: { id: first.body.order.id },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) }
    });
    await ctx
      .http()
      .post('/api/v1/store/orders/expire-reservations')
      .set(auth(board.token))
      .expect(200);

    const expired = await ctx
      .http()
      .get(`/api/v1/me/orders/${first.body.order.id}`)
      .set(auth(token))
      .expect(200);

    expect(expired.body.status).toBe('CANCELLED');
    expect(await stockOf(p.variantId)).toBe(10);
  });

  it('audits manual stock adjustments and refuses negative stock', async () => {
    const p = await product({ stock: 2 });

    await ctx
      .http()
      .post(`/api/v1/store/variants/${p.variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'LOSS', quantity: 3, reason: 'Avaria' })
      .expect(409);
    await ctx
      .http()
      .post(`/api/v1/store/variants/${p.variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'LOSS', quantity: 1, reason: 'Avaria' })
      .expect(201);

    const log = await ctx.prisma.auditLog.findFirst({
      where: { entityId: p.variantId, action: 'inventory.adjusted' },
      orderBy: { occurredAt: 'desc' }
    });

    expect(log?.reason).toBe('Avaria');
    expect(log?.afterData).toMatchObject({ available: 1 });
  });

  it('keeps favorites private and idempotent and merges guest carts on login', async () => {
    const p = await product({ stock: 5 });
    const user = await createUser(ctx.prisma, ['user']);
    const token = await login(ctx, user.email);

    await ctx.http().put(`/api/v1/me/favorites/${p.id}`).set(auth(token)).expect(204);
    await ctx.http().put(`/api/v1/me/favorites/${p.id}`).set(auth(token)).expect(204);
    expect(
      (await ctx.http().get('/api/v1/me/favorites').set(auth(token)).expect(200)).body
    ).toHaveLength(1);
    await ctx.http().put(`/api/v1/me/favorites/${p.id}`).expect(401);

    const agent = guest();

    await agent.put('/api/v1/cart/items').send({ variantId: p.variantId, quantity: 2 }).expect(200);

    const merged = await agent.get('/api/v1/cart').set(auth(token)).expect(200);

    expect(merged.body.itemCount).toBe(2);
  });

  it('archives (deletes) products only with a reason', async () => {
    const p = await product();

    await ctx
      .http()
      .put(`/api/v1/store/products/${p.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ARCHIVED' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/store/products/${p.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ARCHIVED', reason: 'Modelo descontinuado' })
      .expect(200);
    await ctx.http().get(`/api/v1/public/products/${p.slug}`).expect(404);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: p.id, action: 'store.product.archived' }
      })
    ).toBe(1);
  });
});
