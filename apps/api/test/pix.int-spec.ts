import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('PIX automático em modo de teste (DT-071)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let variantId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);

    const category = await ctx
      .http()
      .post('/api/v1/store/categories')
      .set(auth(board.token))
      .send({ name: `PIX ${randomUUID().slice(0, 4)}` })
      .expect(201);
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Garrafa ${randomUUID().slice(0, 4)}`,
        categoryId: category.body.id,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: '35.00'
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

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function order(): Promise<string> {
    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({ variantId, quantity: 2 })
      .expect(200);

    return (
      await ctx
        .http()
        .post('/api/v1/orders/checkout')
        .set(auth(buyer.token))
        .send({ customerPhone: '68 99999-1111', acceptTerms: true })
        .expect(201)
    ).body.order.id;
  }

  it('pedido: QR reaproveitado, pagamento simulado baixa e lança no Caixa', async () => {
    const orderId = await order();
    const first = await ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/pix`)
      .set(auth(buyer.token))
      .expect(200);

    expect(first.body).toMatchObject({ status: 'PENDING', simulated: true });
    expect(first.body.amount.amount).toBe('70.00');
    expect(first.body.qrCode).toMatch(/^000201/);
    expect(first.body.qrSvg).toContain('<svg');

    const again = await ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/pix`)
      .set(auth(buyer.token))
      .expect(200);

    expect(again.body.id).toBe(first.body.id);

    // Outra conta não vê nem paga a cobrança.
    const stranger = await tokenFor(ctx, ['user']);

    await ctx.http().get(`/api/v1/me/pix/${first.body.id}`).set(auth(stranger.token)).expect(404);

    const paid = await ctx
      .http()
      .post(`/api/v1/me/pix/${first.body.id}/simulate`)
      .set(auth(buyer.token))
      .expect(200);

    expect(paid.body.status).toBe('PAID');

    const saved = await ctx.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payments: { include: { financialTransaction: true } } }
    });

    expect(saved.status).toBe('PAID');
    expect(saved.payments[0]).toMatchObject({ status: 'CONFIRMED', provider: 'sandbox' });
    expect(saved.payments[0]?.financialTransaction).toMatchObject({
      direction: 'INCOME',
      status: 'CONFIRMED'
    });

    // Repetir não baixa duas vezes.
    await ctx
      .http()
      .post(`/api/v1/me/pix/${first.body.id}/simulate`)
      .set(auth(buyer.token))
      .expect(200);
    await expect(ctx.prisma.payment.count({ where: { orderId } })).resolves.toBe(1);
  });

  it('mensalidade: QR de 24 h e baixa automática', async () => {
    const athlete = await ctx.prisma.athlete.create({
      data: { fullName: 'Atleta Pix Teste', status: 'ACTIVE', userId: buyer.id }
    });
    const plan = await ctx.prisma.monthlyFeePlan.create({
      data: {
        name: `Plano PIX ${randomUUID().slice(0, 4)}`,
        amount: '80.00',
        currency: 'BRL',
        dueDay: 10
      }
    });
    const fee = await ctx.prisma.monthlyFee.create({
      data: {
        athleteId: athlete.id,
        monthlyFeePlanId: plan.id,
        referenceMonth: new Date('2031-03-01T00:00:00Z'),
        dueDate: new Date('2031-03-10T00:00:00Z'),
        originalAmount: '80.00',
        totalAmount: '80.00',
        currency: 'BRL'
      }
    });
    const charge = await ctx
      .http()
      .post(`/api/v1/me/monthly-fees/${fee.id}/pix`)
      .set(auth(buyer.token))
      .expect(200);
    const hours = (new Date(charge.body.expiresAt).getTime() - Date.now()) / 3_600_000;

    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    await ctx
      .http()
      .post(`/api/v1/me/pix/${charge.body.id}/simulate`)
      .set(auth(buyer.token))
      .expect(200);
    await expect(
      ctx.prisma.monthlyFee.findUniqueOrThrow({ where: { id: fee.id } })
    ).resolves.toMatchObject({ status: 'PAID' });
  });

  it('pago depois do cancelamento: vai para revisão da diretoria, nada é baixado', async () => {
    const orderId = await order();
    const charge = await ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/pix`)
      .set(auth(buyer.token))
      .expect(200);

    await ctx
      .http()
      .put(`/api/v1/store/orders/${orderId}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Cliente desistiu antes de pagar' })
      .expect(200);

    const late = await ctx
      .http()
      .post(`/api/v1/me/pix/${charge.body.id}/simulate`)
      .set(auth(buyer.token))
      .expect(200);

    expect(late.body.status).toBe('REVIEW');
    await expect(ctx.prisma.payment.count({ where: { orderId } })).resolves.toBe(0);

    const admin = await ctx.http().get('/api/v1/payments/pix').set(auth(board.token)).expect(200);

    expect(admin.body.review.map((r: { id: string }) => r.id)).toContain(charge.body.id);
    await ctx
      .http()
      .post(`/api/v1/payments/pix/${charge.body.id}/resolve`)
      .set(auth(board.token))
      .send({ reason: 'Estornado no painel do intermediário' })
      .expect(200);
    await ctx.http().get('/api/v1/payments/pix').set(auth(buyer.token)).expect(403);
  });

  it('visitante paga pelo número e código; aviso de intermediário não configurado é recusado', async () => {
    const agent = request.agent(ctx.app.getHttpServer());

    await agent.put('/api/v1/cart/items').send({ variantId, quantity: 1 }).expect(200);

    const checkout = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Visitante Pix',
        customerEmail: 'visitante-pix@exemplo.test',
        customerPhone: '68 99999-4444',
        acceptTerms: true
      })
      .expect(201);
    const guest = {
      orderNumber: checkout.body.order.orderNumber,
      code: checkout.body.guestAccessCode
    };
    const charge = await ctx.http().post('/api/v1/public/orders/pix').send(guest).expect(200);

    await ctx
      .http()
      .post(`/api/v1/public/pix/${charge.body.id}/simulate`)
      .send(guest)
      .expect(200)
      .then((res) => expect(res.body.status).toBe('PAID'));
    await ctx
      .http()
      .post('/api/v1/payments/pix/webhook/mercadopago?data.id=1')
      .set('x-signature', 'ts=1,v1=00')
      .set('x-request-id', 'r')
      .expect(404);
  });
});
