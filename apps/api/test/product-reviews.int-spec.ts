import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/**
 * Avaliações de produto (DT-081): só quem comprou e recebeu avalia; aparece no site depois
 * de aprovada pela diretoria, com o primeiro nome; recusar exige motivo e fica na auditoria.
 */
describe('Avaliações de produto (DT-081)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let stranger: { token: string; id: string };
  let productId: string;
  let slug: string;
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const review = (token: string, body: Record<string, unknown>) =>
    ctx.http().put(`/api/v1/me/reviews/${productId}`).set(auth(token)).send(body);
  const publicReviews = async () =>
    (await ctx.http().get(`/api/v1/public/products/${slug}/reviews`).expect(200)).body;

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);
    stranger = await tokenFor(ctx, ['user']);

    const categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Avaliação ${tag}` })
        .expect(201)
    ).body.id as string;
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({ name: `Garrafa ${tag}`, categoryId, fulfillmentType: 'STOCK', basePrice: '35.00' })
      .expect(201);
    const variantId = created.body.variants[0].id as string;

    productId = created.body.id as string;
    slug = created.body.slug as string;
    await ctx
      .http()
      .post(`/api/v1/store/variants/${variantId}/stock`)
      .set(auth(board.token))
      .send({ type: 'STOCK_IN', quantity: 5, reason: 'Entrada' })
      .expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/products/${productId}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    // Compra pelo caminho real; a entrega é marcada direto (o foco aqui é quem pode avaliar).
    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({ variantId, quantity: 1 })
      .expect(200);

    const order = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true })
      .expect(201);

    await ctx.prisma.order.update({
      where: { id: order.body.order?.id ?? order.body.id },
      data: { status: 'DELIVERED' }
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('quem não comprou e recebeu não avalia', async () => {
    const mine = await ctx
      .http()
      .get(`/api/v1/me/reviews/${productId}`)
      .set(auth(stranger.token))
      .expect(200);

    expect(mine.body).toEqual({ canReview: false, review: null });

    const refused = await review(stranger.token, { rating: 5 }).expect(403);

    expect(refused.body.code).toBe('NOT_ELIGIBLE');
  });

  it('valida a nota de 1 a 5', async () => {
    await review(buyer.token, { rating: 6 }).expect(422);
    await review(buyer.token, { rating: 0 }).expect(422);
  });

  it('avaliação fica pendente até a diretoria aprovar; site mostra só o primeiro nome', async () => {
    const saved = await review(buyer.token, { rating: 4, comment: '  Gela bem a água.  ' }).expect(
      200
    );

    expect(saved.body).toMatchObject({
      canReview: true,
      review: { rating: 4, comment: 'Gela bem a água.', status: 'PENDING' }
    });
    expect(await publicReviews()).toEqual({ average: null, count: 0, reviews: [] });

    await ctx.http().get('/api/v1/store/reviews').set(auth(buyer.token)).expect(403);

    const queue = await ctx
      .http()
      .get('/api/v1/store/reviews')
      .query({ status: 'PENDING' })
      .set(auth(board.token))
      .expect(200);
    const pending = queue.body.data.find(
      (row: { product: { id: string } }) => row.product.id === productId
    );

    expect(pending).toBeDefined();

    await ctx
      .http()
      .post(`/api/v1/store/reviews/${pending.id}/moderate`)
      .set(auth(board.token))
      .send({ decision: 'APPROVE' })
      .expect(201);

    const shown = await publicReviews();

    expect(shown).toMatchObject({ average: 4, count: 1 });
    expect(shown.reviews[0]).toMatchObject({ rating: 4, comment: 'Gela bem a água.' });
    expect(shown.reviews[0].author).not.toContain(' ');
    expect(
      await ctx.prisma.notification.count({
        where: { userId: buyer.id, type: 'store.review_approved' }
      })
    ).toBe(1);
  });

  it('editar volta para a fila; recusar exige motivo e fica na auditoria', async () => {
    await review(buyer.token, { rating: 2 }).expect(200);
    expect((await publicReviews()).count).toBe(0);

    const row = await ctx.prisma.productReview.findFirstOrThrow({
      where: { productId, userId: buyer.id }
    });

    await ctx
      .http()
      .post(`/api/v1/store/reviews/${row.id}/moderate`)
      .set(auth(board.token))
      .send({ decision: 'REJECT' })
      .expect(422);
    await ctx
      .http()
      .post(`/api/v1/store/reviews/${row.id}/moderate`)
      .set(auth(board.token))
      .send({ decision: 'REJECT', reason: 'Fala de outro produto.' })
      .expect(201);

    const mine = await ctx
      .http()
      .get(`/api/v1/me/reviews/${productId}`)
      .set(auth(buyer.token))
      .expect(200);

    expect(mine.body.review).toMatchObject({
      status: 'REJECTED',
      moderationReason: 'Fala de outro produto.'
    });
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'review.moderated', entityId: row.id }
      })
    ).toBe(2);
  });
});
