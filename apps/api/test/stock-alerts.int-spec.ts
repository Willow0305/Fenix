import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** "Avise-me quando chegar" (DT-081): pedir, avisar na entrada em estoque e apagar o pedido. */
describe('Avise-me quando chegar (DT-081)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let productSlug: string;
  let variantId: string;
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const stock = (type: 'STOCK_IN' | 'LOSS', quantity: number) =>
    ctx
      .http()
      .post(`/api/v1/store/variants/${variantId}/stock`)
      .set(auth(board.token))
      .send({ type, quantity, reason: 'Teste de aviso' })
      .expect(201);
  const alerts = async () =>
    (
      await ctx
        .http()
        .get('/api/v1/me/stock-alerts')
        .query({ variantIds: variantId })
        .set(auth(buyer.token))
        .expect(200)
    ).body.variantIds as string[];

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);

    const categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Aviso ${tag}` })
        .expect(201)
    ).body.id as string;
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Camisa aviso ${tag}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '80.00'
      })
      .expect(201);

    variantId = created.body.variants[0].id as string;
    productSlug = created.body.slug as string;
    await ctx
      .http()
      .put(`/api/v1/store/products/${created.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('exige conta', async () => {
    await ctx.http().put(`/api/v1/me/stock-alerts/${variantId}`).expect(401);
  });

  it('pede o aviso sem estoque, avisa uma vez na entrada e apaga o pedido', async () => {
    await ctx.http().put(`/api/v1/me/stock-alerts/${variantId}`).set(auth(buyer.token)).expect(204);
    // Pedir de novo não duplica.
    await ctx.http().put(`/api/v1/me/stock-alerts/${variantId}`).set(auth(buyer.token)).expect(204);
    expect(await alerts()).toEqual([variantId]);

    await stock('STOCK_IN', 5);

    const notes = await ctx.prisma.notification.findMany({
      where: { userId: buyer.id, type: 'store.stock_back' }
    });

    expect(notes).toHaveLength(1);
    expect(notes[0]?.payload).toEqual({ link: `/loja/${productSlug}` });
    expect(await alerts()).toEqual([]);

    // Nova entrada com estoque já disponível não avisa de novo.
    await stock('STOCK_IN', 2);
    expect(
      await ctx.prisma.notification.count({
        where: { userId: buyer.id, type: 'store.stock_back' }
      })
    ).toBe(1);
  });

  it('recusa o pedido quando já há estoque e permite cancelar', async () => {
    const response = await ctx
      .http()
      .put(`/api/v1/me/stock-alerts/${variantId}`)
      .set(auth(buyer.token))
      .expect(409);

    expect(response.body.code).toBe('IN_STOCK');

    await stock('LOSS', 7);
    await ctx.http().put(`/api/v1/me/stock-alerts/${variantId}`).set(auth(buyer.token)).expect(204);
    await ctx
      .http()
      .delete(`/api/v1/me/stock-alerts/${variantId}`)
      .set(auth(buyer.token))
      .expect(204);
    expect(await alerts()).toEqual([]);
  });
});
