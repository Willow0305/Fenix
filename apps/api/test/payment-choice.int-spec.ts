import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Forma de pagamento no checkout e cancelamento pelo comprador (DT-076). */
describe('Forma de pagamento e cancelamento pelo comprador (DT-076)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const minutes = (iso: string) => (new Date(iso).getTime() - Date.now()) / 60_000;

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Pagamento ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Produto com 3 em estoque no carrinho do comprador; devolve a variação. */
  async function cart(token = buyer.token): Promise<string> {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Caneca ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '20.00'
      })
      .expect(201);
    const variantId = product.body.variants[0].id as string;

    await ctx
      .http()
      .post(`/api/v1/store/variants/${variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'STOCK_IN', quantity: 3, reason: 'Entrada' })
      .expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(token))
      .send({ variantId, quantity: 1 })
      .expect(200);

    return variantId;
  }

  const checkout = (body: Record<string, unknown> = {}) =>
    ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true, ...body });

  it('PIX reserva 30 minutos; cartão reserva 72 horas e avisa a diretoria', async () => {
    await cart();

    const pix = await checkout().expect(201);

    expect(pix.body.order.paymentChoice).toBe('PIX');
    expect(minutes(pix.body.order.reservationExpiresAt)).toBeGreaterThan(28);
    expect(minutes(pix.body.order.reservationExpiresAt)).toBeLessThanOrEqual(30);

    await cart();

    const card = await checkout({ paymentChoice: 'CARD' }).expect(201);

    expect(card.body.order.paymentChoice).toBe('CARD');
    expect(minutes(card.body.order.reservationExpiresAt) / 60).toBeGreaterThan(71);

    const alert = await ctx.prisma.notification.findFirst({
      where: { deduplicationKey: `staff-order:${card.body.order.id}` }
    });

    expect(alert?.title).toContain('pagar com cartão');
  });

  it('QR do PIX vale 30 minutos ou mais e a reserva acompanha o QR', async () => {
    await cart();

    const order = await checkout().expect(201);
    const id = order.body.order.id as string;

    // Reserva quase no fim: o QR do intermediário precisa de 30 minutos.
    await ctx.prisma.order.update({
      where: { id },
      data: { reservationExpiresAt: new Date(Date.now() + 5 * 60_000) }
    });

    const qr = await ctx
      .http()
      .post(`/api/v1/me/orders/${id}/pix`)
      .set(auth(buyer.token))
      .expect(200);
    const row = await ctx.prisma.order.findUniqueOrThrow({ where: { id } });

    expect(minutes(qr.body.expiresAt)).toBeGreaterThanOrEqual(30);
    expect(row.reservationExpiresAt?.toISOString()).toBe(qr.body.expiresAt);
  });

  it('comprador cancela antes de pagar: estoque volta; pago ou com comprovante não cancela', async () => {
    const variantId = await cart();
    const order = await checkout().expect(201);
    const id = order.body.order.id as string;
    const stock = async () =>
      (
        await ctx.prisma.inventoryMovement.aggregate({
          where: { productVariantId: variantId },
          _sum: { quantityDelta: true }
        })
      )._sum.quantityDelta;

    expect(await stock()).toBe(2);

    const other = await tokenFor(ctx, ['user']);

    await ctx.http().post(`/api/v1/me/orders/${id}/cancel`).set(auth(other.token)).expect(404);

    const cancelled = await ctx
      .http()
      .post(`/api/v1/me/orders/${id}/cancel`)
      .set(auth(buyer.token))
      .expect(200);

    expect(cancelled.body.status).toBe('CANCELLED');
    expect(await stock()).toBe(3);
    await ctx.http().post(`/api/v1/me/orders/${id}/cancel`).set(auth(buyer.token)).expect(409);

    // Com pagamento em análise, só a diretoria cancela.
    await cart();

    const pending = await checkout().expect(201);
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/store/orders/${pending.body.order.id}/payments`)
      .set(auth(board.token))
      .set({ 'Idempotency-Key': `test-${randomUUID()}` })
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-28' })
      .expect(201);
    await ctx
      .http()
      .post(`/api/v1/me/orders/${pending.body.order.id}/cancel`)
      .set(auth(buyer.token))
      .expect(409);
  });

  it('visitante cancela com número e código', async () => {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Copo ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: '15.00'
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    // Visitante: o agente guarda o cookie do carrinho entre as chamadas.
    const agent = request.agent(ctx.app.getHttpServer());

    await agent
      .put('/api/v1/cart/items')
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(200);

    const order = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Visitante Cancela',
        customerEmail: `cancela-${randomUUID().slice(0, 4)}@exemplo.test`,
        customerPhone: '68 99999-2222',
        acceptTerms: true
      })
      .expect(201);

    await ctx
      .http()
      .post('/api/v1/public/orders/cancel')
      .send({ orderNumber: order.body.order.orderNumber, code: 'codigo-errado-123' })
      .expect(404);

    const cancelled = await ctx
      .http()
      .post('/api/v1/public/orders/cancel')
      .send({ orderNumber: order.body.order.orderNumber, code: order.body.guestAccessCode })
      .expect(200);

    expect(cancelled.body.status).toBe('CANCELLED');
  });
});
