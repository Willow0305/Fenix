import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Entrega em casa (DT-075): regiões, checkout, taxa, "Entregas" no Caixa e devolução. */
describe('Entrega em casa (DT-075)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let categoryId: string;
  let accountId: string;
  let zoneId: string;
  let centro: string;
  let bosque: string;
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  const address = (neighborhoodId: string) => ({
    postalCode: '69900-000',
    street: 'Rua das Flores',
    number: '10',
    complement: 'casa 2',
    neighborhoodId,
    reference: 'Perto da praça'
  });
  const settings = (body: Record<string, unknown>) =>
    ctx.http().put('/api/v1/store/delivery/settings').set(auth(board.token)).send(body);

  beforeAll(async () => {
    process.env['POSTAL_CODE_LOOKUP'] = 'off';
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Entrega ${tag}` })
        .expect(201)
    ).body.id;
    accountId = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Entregas ${tag}`, type: 'BANK' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await settings({ enabled: false, freeMinimum: '' });
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function cartWith(quantity: number): Promise<void> {
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Garrafa ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '100.00'
      })
      .expect(201);
    const variantId = created.body.variants[0].id as string;

    await ctx
      .http()
      .post(`/api/v1/store/variants/${variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'STOCK_IN', quantity: 10, reason: 'Entrada' })
      .expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/products/${created.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({ variantId, quantity })
      .expect(200);
  }

  const checkout = (body: Record<string, unknown>) =>
    ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true, ...body });

  it('diretoria cadastra regiões; bairro só em uma região; só ela configura', async () => {
    await ctx.http().get('/api/v1/store/delivery').set(auth(buyer.token)).expect(403);

    const zone = await ctx
      .http()
      .post('/api/v1/store/delivery/zones')
      .set(auth(board.token))
      .send({
        name: `Centro ${tag}`,
        fee: '12.00',
        leadDays: 2,
        neighborhoods: [`Centro ${tag}\nBosque ${tag}`, `centro ${tag}`]
      })
      .expect(201);

    zoneId = zone.body.id;
    expect(zone.body.neighborhoods).toHaveLength(2);
    centro = zone.body.neighborhoods.find((n: { name: string }) => n.name.startsWith('Centro')).id;
    bosque = zone.body.neighborhoods.find((n: { name: string }) => n.name.startsWith('Bosque')).id;

    await ctx
      .http()
      .post('/api/v1/store/delivery/zones')
      .set(auth(board.token))
      .send({ name: `Outra ${tag}`, fee: '15.00', leadDays: 3, neighborhoods: [`Bosque ${tag}`] })
      .expect(409);

    await settings({ enabled: true, freeMinimum: '' }).expect(200);

    const options = await ctx.http().get('/api/v1/public/delivery').expect(200);

    expect(options.body.enabled).toBe(true);
    expect(options.body.zones.map((z: { id: string }) => z.id)).toContain(zoneId);
  });

  it('checkout com entrega: taxa no total, cópia do endereço e endereço salvo', async () => {
    await cartWith(1);
    await checkout({ fulfillment: 'DELIVERY' }).expect(422);
    await checkout({ fulfillment: 'DELIVERY', address: address(randomUUID()) }).expect(422);

    const order = await checkout({
      fulfillment: 'DELIVERY',
      address: address(centro),
      saveAddress: true
    }).expect(201);

    expect(order.body.order).toMatchObject({
      fulfillment: 'DELIVERY',
      deliveryFee: { amount: '12.00' },
      totalAmount: { amount: '112.00' },
      deliveryAddress: {
        postalCode: '69900000',
        street: 'Rua das Flores',
        neighborhood: `Centro ${tag}`,
        city: 'Rio Branco',
        state: 'AC',
        zoneName: `Centro ${tag}`,
        leadDays: 2
      }
    });

    const saved = await ctx.http().get('/api/v1/me/addresses').set(auth(buyer.token)).expect(200);

    expect(saved.body).toHaveLength(1);
    expect(saved.body[0]).toMatchObject({ isDefault: true, served: true, number: '10' });
  });

  it('frete grátis a partir do mínimo e endereço salvo no checkout', async () => {
    await settings({ freeMinimum: '150.00' }).expect(200);
    await cartWith(2);

    const saved = await ctx.http().get('/api/v1/me/addresses').set(auth(buyer.token)).expect(200);
    const order = await checkout({ fulfillment: 'DELIVERY', addressId: saved.body[0].id }).expect(
      201
    );

    expect(order.body.order).toMatchObject({
      deliveryFee: { amount: '0.00' },
      totalAmount: { amount: '200.00' }
    });
    await settings({ freeMinimum: '' }).expect(200);
  });

  it('pagamento separa a taxa em "Entregas"; entrega com estados próprios; desistência devolve tudo', async () => {
    await cartWith(1);

    const created = await checkout({ fulfillment: 'DELIVERY', address: address(bosque) }).expect(
      201
    );
    const id = created.body.order.id as string;
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/store/orders/${id}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-28', accountId })
      .expect(201);

    const payments = await ctx.prisma.payment.findMany({
      where: { orderId: id },
      include: { financialTransaction: { include: { category: true } } },
      orderBy: { isDeliveryFee: 'asc' }
    });

    expect(payments.map((p) => [p.amount.toFixed(2), p.status, p.isDeliveryFee])).toEqual([
      ['100.00', 'CONFIRMED', false],
      ['12.00', 'CONFIRMED', true]
    ]);
    expect(payments[1]?.financialTransaction?.category.code).toBe('entregas');
    await expect(ctx.prisma.order.findUniqueOrThrow({ where: { id } })).resolves.toMatchObject({
      status: 'PAID'
    });

    const status = (value: string) =>
      ctx
        .http()
        .put(`/api/v1/store/orders/${id}/status`)
        .set(auth(board.token))
        .send({ status: value });

    const dispatch = () =>
      ctx.http().post(`/api/v1/store/orders/${id}/dispatch`).set(auth(board.token)).send({});

    await status('READY_FOR_PICKUP').expect(409);
    // "Saiu para entrega" só pelo registro da saída (código e link do entregador).
    await status('OUT_FOR_DELIVERY').expect(409);
    await dispatch().expect(201);
    await status('PROCESSING').expect(422);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'PROCESSING', reason: 'Ninguém em casa' })
      .expect(200);
    await dispatch().expect(201);
    await status('DELIVERED').expect(200);
    await ctx
      .http()
      .post(`/api/v1/me/orders/${id}/receipt`)
      .set(auth(buyer.token))
      .expect((res) => expect([200, 201]).toContain(res.status));

    const order = await ctx
      .http()
      .get(`/api/v1/me/orders/${id}`)
      .set(auth(buyer.token))
      .expect(200);

    expect(order.body.outForDeliveryAt).not.toBeNull();

    const requested = await ctx
      .http()
      .post(`/api/v1/me/orders/${id}/returns`)
      .set(auth(buyer.token))
      .send({
        kind: 'WITHDRAWAL',
        items: [{ orderItemId: order.body.items[0].id, quantity: 1 }]
      })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/store/returns/${requested.body.returns[0].id}/decide`)
      .set(auth(board.token))
      .send({ response: 'Estorno integral, com a entrega.' })
      .expect(200);

    const refunds = await ctx.prisma.refund.findMany({
      where: { orderId: id },
      include: { payment: { select: { isDeliveryFee: true } } }
    });

    expect(refunds.map((r) => [r.amount.toFixed(2), r.payment.isDeliveryFee]).sort()).toEqual([
      ['100.00', false],
      ['12.00', true]
    ]);
  });

  it('pedido de retirada não pode sair para entrega; entrega desligada recusa o checkout', async () => {
    await cartWith(1);

    const pickup = await checkout({}).expect(201);

    expect(pickup.body.order).toMatchObject({
      fulfillment: 'PICKUP',
      deliveryFee: { amount: '0.00' },
      deliveryAddress: null
    });

    await settings({ enabled: false }).expect(200);
    await cartWith(1);
    await checkout({ fulfillment: 'DELIVERY', address: address(centro) }).expect(422);

    const options = await ctx.http().get('/api/v1/public/delivery').expect(200);

    expect(options.body).toMatchObject({ enabled: false, zones: [] });
  });

  it('endereços: padrão, apagar só o próprio e CEP inválido', async () => {
    await settings({ enabled: true }).expect(200);

    const second = await ctx
      .http()
      .post('/api/v1/me/addresses')
      .set(auth(buyer.token))
      .send({ ...address(bosque), label: 'Trabalho', isDefault: true })
      .expect(201);

    expect(second.body.isDefault).toBe(true);

    const list = await ctx.http().get('/api/v1/me/addresses').set(auth(buyer.token)).expect(200);

    expect(list.body.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);

    const other = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .delete(`/api/v1/me/addresses/${second.body.id}`)
      .set(auth(other.token))
      .expect(404);
    await ctx
      .http()
      .delete(`/api/v1/me/addresses/${second.body.id}`)
      .set(auth(buyer.token))
      .expect(204);
    await ctx.http().get('/api/v1/public/postal-codes/123').expect(422);
    await ctx
      .http()
      .get('/api/v1/public/postal-codes/69900000')
      .expect(200)
      .expect((res) => expect(res.body).toEqual({ address: null }));

    // Região excluída sai das opções; pedidos antigos guardam a cópia.
    await ctx
      .http()
      .delete(`/api/v1/store/delivery/zones/${zoneId}`)
      .set(auth(board.token))
      .send({ reason: 'Fim do teste' })
      .expect(204);
  });
});
