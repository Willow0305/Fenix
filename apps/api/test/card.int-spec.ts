import { randomUUID } from 'node:crypto';

import { CardService } from '../src/modules/card/application/card.service';
import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Cartão pelo site em modo de teste (DT-079). */
describe('Cartão pelo site (DT-079)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  const card = (body: Record<string, unknown>) => ({
    token: 'sandbox-approved',
    paymentMethodId: 'visa',
    installments: 1,
    paymentType: 'credit_card',
    ...body
  });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Cartão ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Produto com regra de sem juros (ou nenhuma) já no carrinho. */
  async function addProduct(interestFree: number | null, price = '120.00'): Promise<void> {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Agasalho ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: price,
        ...(interestFree ? { interestFreeInstallments: interestFree } : {})
      })
      .expect(201);
    const variantId = product.body.variants[0].id as string;

    expect(product.body.interestFreeInstallments).toBe(interestFree);
    await ctx
      .http()
      .post(`/api/v1/store/variants/${variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'STOCK_IN', quantity: 5, reason: 'Entrada' })
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
      .set(auth(buyer.token))
      .send({ variantId, quantity: 1 })
      .expect(200);
  }

  const checkout = () =>
    ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true, paymentChoice: 'ONLINE_CARD' })
      .expect(201);
  const pay = (orderId: string, body: Record<string, unknown>) =>
    ctx
      .http()
      .post(`/api/v1/me/orders/${orderId}/card`)
      .set(auth(buyer.token))
      .set(key())
      .send(card(body));

  it('modo de teste ligado; pedido com cartão reserva 30 minutos', async () => {
    const available = await ctx.http().get('/api/v1/public/card').expect(200);

    expect(available.body).toEqual({ enabled: true, simulated: true, maxInstallments: 12 });

    await addProduct(null);

    const order = await checkout();
    const minutes =
      (new Date(order.body.order.reservationExpiresAt).getTime() - Date.now()) / 60_000;

    expect(order.body.order.paymentChoice).toBe('ONLINE_CARD');
    expect(minutes).toBeLessThanOrEqual(30);
    expect(minutes).toBeGreaterThan(28);
  });

  it('sem juros do pedido é a menor regra entre os produtos', async () => {
    await addProduct(6);
    await addProduct(3);

    const order = await checkout();
    const info = await ctx
      .http()
      .get(`/api/v1/me/orders/${order.body.order.id}/card`)
      .set(auth(buyer.token))
      .expect(200);

    expect(info.body).toMatchObject({
      amount: { amount: '240.00' },
      maxInstallments: 12,
      interestFreeUpTo: 3,
      simulated: true
    });

    await addProduct(6);
    await addProduct(null);

    const mixed = await checkout();
    const none = await ctx
      .http()
      .get(`/api/v1/me/orders/${mixed.body.order.id}/card`)
      .set(auth(buyer.token))
      .expect(200);

    expect(none.body.interestFreeUpTo).toBe(0);
  });

  it('recusado mostra o motivo; débito só à vista; aprovado em 6x baixa no Caixa', async () => {
    await addProduct(3);

    const order = await checkout();
    const id = order.body.order.id as string;
    const rejected = await pay(id, { token: 'sandbox-rejected' }).expect(200);

    expect(rejected.body).toMatchObject({
      status: 'REJECTED',
      message: 'Limite insuficiente no cartão.'
    });
    await pay(id, { paymentType: 'debit_card', installments: 3 }).expect(422);
    await pay(id, { installments: 13 }).expect(422);

    const approved = await pay(id, { installments: 6 }).expect(200);

    expect(approved.body).toMatchObject({
      status: 'PAID',
      installments: 6,
      interestFree: false,
      lastFour: '4242'
    });

    const paid = await ctx.prisma.order.findUniqueOrThrow({
      where: { id },
      include: { payments: { include: { paymentMethod: true, financialTransaction: true } } }
    });

    expect(paid.status).toBe('PAID');
    expect(paid.payments[0]?.paymentMethod.code).toBe('cartao-credito');
    expect(paid.payments[0]?.financialTransaction?.amount.toFixed(2)).toBe('120.00');

    // Pago: não aceita outro cartão.
    await pay(id, {}).expect(409);
  });

  it('em análise bloqueia nova tentativa; estorno do pedido vai ao intermediário pela fila', async () => {
    await addProduct(null);

    const pending = await checkout();

    await pay(pending.body.order.id, { token: 'sandbox-pending' }).expect(200);
    await pay(pending.body.order.id, {}).expect(409);

    await addProduct(null, '80.00');

    const order = await checkout();
    const id = order.body.order.id as string;

    await pay(id, { paymentType: 'debit_card' }).expect(200);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Comprador desistiu antes da entrega' })
      .expect(200);

    const refund = await ctx.prisma.refund.findFirstOrThrow({ where: { orderId: id } });

    expect(refund.providerRefundStatus).toBeNull();
    await ctx.app.get(CardService).sendRefunds();
    await expect(
      ctx.prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })
    ).resolves.toMatchObject({ providerRefundStatus: 'SENT' });
  });

  it('visitante paga pelo número e código; diretoria grava os códigos de sem juros', async () => {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Toalha ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: '50.00'
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const { default: request } = await import('supertest');
    const agent = request.agent(ctx.app.getHttpServer());

    await agent
      .put('/api/v1/cart/items')
      .send({ variantId: product.body.variants[0].id, quantity: 1 })
      .expect(200);

    const order = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Visitante Cartão',
        customerEmail: `cartao-${randomUUID().slice(0, 4)}@exemplo.test`,
        customerPhone: '68 99999-3333',
        acceptTerms: true,
        paymentChoice: 'ONLINE_CARD'
      })
      .expect(201);
    const guest = {
      orderNumber: order.body.order.orderNumber,
      code: order.body.guestAccessCode
    };

    await ctx.http().post('/api/v1/public/orders/card/checkout').send(guest).expect(200);

    const paid = await ctx
      .http()
      .post('/api/v1/public/orders/card')
      .set(key())
      .send({ ...card({}), ...guest })
      .expect(200);

    expect(paid.body.status).toBe('PAID');

    await ctx
      .http()
      .put('/api/v1/payments/card/differential-pricing')
      .set(auth(buyer.token))
      .send({ entries: [] })
      .expect(403);

    const codes = await ctx
      .http()
      .put('/api/v1/payments/card/differential-pricing')
      .set(auth(board.token))
      .send({
        entries: [
          { installments: 3, id: '12345' },
          { installments: 6, id: '67890' }
        ]
      })
      .expect(200);

    expect(codes.body.differentialPricing).toEqual([
      { installments: 3, id: '12345' },
      { installments: 6, id: '67890' }
    ]);
    await ctx
      .http()
      .put('/api/v1/payments/card/differential-pricing')
      .set(auth(board.token))
      .send({ entries: [{ installments: 1, id: 'x' }] })
      .expect(422);
  });
});
