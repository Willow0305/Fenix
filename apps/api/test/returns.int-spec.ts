import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, PNG_1X1, type TestContext, tokenFor } from './helpers';

describe('Entrega comprovada, desistência e defeito (DT-070)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let categoryId: string;
  let accountId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Devoluções ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
    accountId = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Loja ${randomUUID().slice(0, 4)}`, type: 'BANK' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function product(personalized = false) {
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Bola ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: personalized ? 'MADE_TO_ORDER' : 'STOCK',
        basePrice: '100.00'
      })
      .expect(201);
    const id = created.body.id as string;
    const variantId = created.body.variants[0].id as string;
    let fieldId: string | null = null;

    if (personalized) {
      const detail = await ctx
        .http()
        .post(`/api/v1/store/products/${id}/personalization-fields`)
        .set(auth(board.token))
        .send({ label: 'Nome', kind: 'TEXT', required: true })
        .expect(201);

      fieldId = detail.body.personalizationFields[0].id;
    } else {
      await ctx
        .http()
        .post(`/api/v1/store/variants/${variantId}/stock`)
        .set(auth(board.token))
        .send({ type: 'STOCK_IN', quantity: 10, reason: 'Entrada' })
        .expect(201);
    }

    await ctx
      .http()
      .put(`/api/v1/store/products/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return { variantId, fieldId };
  }

  async function paidOrder(personalized = false, quantity = 2) {
    const p = await product(personalized);

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({
        variantId: p.variantId,
        quantity,
        ...(p.fieldId ? { personalization: { [p.fieldId]: 'Ana' } } : {})
      })
      .expect(200);

    const order = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true, acceptPersonalized: true })
      .expect(201);
    const id = order.body.order.id as string;
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/store/orders/${id}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-20', accountId })
      .expect(201);

    return { id, itemId: order.body.order.items[0].id as string };
  }

  const requestReturn = (orderId: string, body: Record<string, unknown>) =>
    ctx.http().post(`/api/v1/me/orders/${orderId}/returns`).set(auth(buyer.token)).send(body);
  const decide = (id: string, body: Record<string, unknown>) =>
    ctx.http().post(`/api/v1/store/returns/${id}/decide`).set(auth(board.token)).send(body);

  it('desiste antes e depois da entrega: estorno parcial vinculado e prazo da prova', async () => {
    const order = await paidOrder();

    // Ainda não entregue: pode desistir; vira estorno direto (nada a devolver).
    const before = await requestReturn(order.id, {
      kind: 'WITHDRAWAL',
      items: [{ orderItemId: order.itemId, quantity: 1 }]
    }).expect(201);
    const first = before.body.returns[0];

    expect(first.status).toBe('OPEN');
    await decide(first.id, { response: 'Estorno feito por PIX.' }).expect(200);

    const payment = await ctx.prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    const refund = await ctx.prisma.refund.findFirstOrThrow({ where: { paymentId: payment.id } });
    const exit = await ctx.prisma.financialTransaction.findFirstOrThrow({
      where: { refundId: refund.id }
    });

    expect(payment.status).toBe('PARTIALLY_REFUNDED');
    expect(refund.amount.toFixed(2)).toBe('100.00');
    expect(exit).toMatchObject({ direction: 'EXPENSE', origin: 'REFUND', status: 'CONFIRMED' });

    // Entregue sem prova: aguarda o "Recebi"; prazo ainda não começou.
    await ctx
      .http()
      .put(`/api/v1/store/orders/${order.id}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(200);

    let rights = await ctx
      .http()
      .get(`/api/v1/me/orders/${order.id}/rights`)
      .set(auth(buyer.token))
      .expect(200);

    expect(rights.body).toMatchObject({ awaitingReceipt: true, withdrawalUntil: null });
    expect(rights.body.items[0].available).toBe(1);

    rights = await ctx
      .http()
      .post(`/api/v1/me/orders/${order.id}/receipt`)
      .set(auth(buyer.token))
      .expect(200);
    expect(rights.body.awaitingReceipt).toBe(false);
    expect(rights.body.withdrawalUntil).not.toBeNull();

    const after = await requestReturn(order.id, {
      kind: 'WITHDRAWAL',
      items: [{ orderItemId: order.itemId, quantity: 1 }]
    }).expect(201);
    const second = after.body.returns[0];

    expect(second.status).toBe('AWAITING_ITEM');
    // Desistência no prazo não pode ser negada.
    await decide(second.id, { reject: true, response: 'Não aceitamos.' }).expect(409);
    await decide(second.id, { response: 'Bola devolvida, estorno feito.' }).expect(200);
    await requestReturn(order.id, {
      kind: 'WITHDRAWAL',
      items: [{ orderItemId: order.itemId, quantity: 1 }]
    }).expect(409);
    await expect(
      ctx.prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })
    ).resolves.toMatchObject({ status: 'REFUNDED' });
  });

  it('passado o prazo de 7 dias, não desiste; defeito segue até 90 dias', async () => {
    const order = await paidOrder(false, 1);

    await ctx
      .http()
      .put(`/api/v1/store/orders/${order.id}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/store/orders/${order.id}/delivery-proof`)
      .set(auth(board.token))
      .attach('file', PNG_1X1, 'entrega.png')
      .expect(200);
    await ctx.prisma.order.update({
      where: { id: order.id },
      data: { deliveryConfirmedAt: new Date(Date.now() - 10 * 86_400_000) }
    });

    const late = await requestReturn(order.id, {
      kind: 'WITHDRAWAL',
      items: [{ orderItemId: order.itemId, quantity: 1 }]
    }).expect(409);

    expect(late.body.code).toBe('WITHDRAWAL_EXPIRED');
    await requestReturn(order.id, {
      kind: 'DEFECT',
      items: [{ orderItemId: order.itemId, quantity: 1 }],
      description: 'curto'
    }).expect(422);
    await requestReturn(order.id, {
      kind: 'DEFECT',
      items: [{ orderItemId: order.itemId, quantity: 1 }],
      description: 'A costura abriu na primeira semana de uso.'
    }).expect(201);
  });

  it('personalizado: sem desistência, mas com defeito resolvido por troca', async () => {
    const order = await paidOrder(true, 1);

    await ctx
      .http()
      .put(`/api/v1/store/orders/${order.id}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/me/orders/${order.id}/receipt`)
      .set(auth(buyer.token))
      .expect(200);

    const denied = await requestReturn(order.id, {
      kind: 'WITHDRAWAL',
      items: [{ orderItemId: order.itemId, quantity: 1 }]
    }).expect(409);

    expect(denied.body.code).toBe('PERSONALIZED_NO_WITHDRAWAL');

    const defect = await requestReturn(order.id, {
      kind: 'DEFECT',
      items: [{ orderItemId: order.itemId, quantity: 1 }],
      description: 'O nome veio com a letra errada.'
    }).expect(201);
    const badges = await ctx
      .http()
      .get('/api/v1/dashboard/badges')
      .set(auth(board.token))
      .expect(200);

    expect(badges.body['/admin/devolucoes']).toBeGreaterThan(0);

    const solved = await decide(defect.body.returns[0].id, {
      resolution: 'EXCHANGE',
      response: 'Vamos refazer a camisa com o nome correto.'
    }).expect(200);

    expect(solved.body).toMatchObject({ status: 'RESOLVED', resolution: 'EXCHANGE' });
    await expect(ctx.prisma.refund.count({ where: { orderId: order.id } })).resolves.toBe(0);

    const user = await tokenFor(ctx, ['user']);

    await ctx.http().get('/api/v1/store/returns').set(auth(user.token)).expect(403);
  });

  it('cancelar o pedido depois de um reembolso parcial devolve o restante', async () => {
    const order = await paidOrder(false, 2);
    const withdrawal = await requestReturn(order.id, {
      kind: 'WITHDRAWAL',
      items: [{ orderItemId: order.itemId, quantity: 1 }]
    }).expect(201);

    await decide(withdrawal.body.returns[0].id, { response: 'Estorno de uma unidade.' }).expect(
      200
    );
    await ctx
      .http()
      .put(`/api/v1/store/orders/${order.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Cliente desistiu do restante', restock: true })
      .expect(200);

    const refunds = await ctx.prisma.refund.findMany({ where: { orderId: order.id } });
    const total = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

    expect(total).toBe(200);
    await expect(
      ctx.prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })
    ).resolves.toMatchObject({ status: 'REFUNDED' });
  });

  it('visitante usa o número e o código do pedido', async () => {
    const p = await product();
    const agent = request.agent(ctx.app.getHttpServer());

    await agent.put('/api/v1/cart/items').send({ variantId: p.variantId, quantity: 1 }).expect(200);

    const checkout = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Visitante Teste',
        customerEmail: 'visitante@exemplo.test',
        customerPhone: '68 99999-3333',
        acceptTerms: true
      })
      .expect(201);
    const guest = {
      orderNumber: checkout.body.order.orderNumber,
      code: checkout.body.guestAccessCode
    };

    await ctx.http().post('/api/v1/public/orders/rights').send(guest).expect(200);
    await ctx
      .http()
      .post('/api/v1/public/orders/rights')
      .send({ ...guest, code: 'codigo-errado-123' })
      .expect(404);
  });
});
