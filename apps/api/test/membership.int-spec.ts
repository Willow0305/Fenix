import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Afiliação vendida pela loja (DT-068)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let buyerEmail: string;
  let productId: string;
  let variantId: string;
  let accountId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    buyer = await tokenFor(ctx, ['user']);
    buyerEmail = (
      await ctx.prisma.user.update({
        where: { id: buyer.id },
        data: { name: 'Ana Compradora Lima', emailVerifiedAt: new Date() },
        select: { email: true }
      })
    ).email;

    const category = await ctx
      .http()
      .post('/api/v1/store/categories')
      .set(auth(board.token))
      .send({ name: `Afiliação ${randomUUID().slice(0, 4)}` })
      .expect(201);
    const base = {
      name: `Afiliação anual ${randomUUID().slice(0, 4)}`,
      categoryId: category.body.id,
      fulfillmentType: 'MEMBERSHIP',
      basePrice: '120.00'
    };

    await ctx.http().post('/api/v1/store/products').set(auth(board.token)).send(base).expect(422);

    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({ ...base, membershipMonths: 12 })
      .expect(201);

    productId = product.body.id;
    variantId = product.body.variants[0].id;
    expect(product.body.membershipMonths).toBe(12);
    await ctx
      .http()
      .put(`/api/v1/store/products/${productId}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);
    accountId = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Afiliações ${randomUUID().slice(0, 4)}`, type: 'BANK' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function pay(orderId: string): Promise<void> {
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/store/orders/${orderId}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-20', accountId })
      .expect(201);
  }

  const setQuantity = (quantity: number) =>
    ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(buyer.token))
      .send({ variantId, quantity })
      .expect(200);

  it('exige conta; o comprador é o beneficiário 1 e cada unidade pede um nome', async () => {
    await request(ctx.app.getHttpServer())
      .put('/api/v1/cart/items')
      .send({ variantId, quantity: 1 })
      .expect(422);

    const cart = await setQuantity(2);
    const line = cart.body.lines[0];

    expect(line.beneficiaries[0]).toMatchObject({ name: 'Ana Compradora Lima', email: buyerEmail });
    expect(line.beneficiaries[1].name).toBe('');
    expect(line.warning).toBe('BENEFICIARIES_REQUIRED');
    await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true })
      .expect(422)
      .then((res) => expect(res.body.code).toBe('BENEFICIARIES_REQUIRED'));
  });

  it('paga: nasce uma carteirinha por beneficiário e o pedido fica entregue', async () => {
    const cart = await ctx.http().get('/api/v1/cart').set(auth(buyer.token)).expect(200);
    const lineId = cart.body.lines[0].id as string;

    await ctx
      .http()
      .put(`/api/v1/cart/items/${lineId}/beneficiaries`)
      .set(auth(buyer.token))
      .send({ beneficiaries: [{ name: 'Ana Compradora Lima', email: buyerEmail }] })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/cart/items/${lineId}/beneficiaries`)
      .set(auth(buyer.token))
      .send({
        beneficiaries: [
          { name: 'Ana Compradora Lima', email: buyerEmail },
          { name: 'Rui Filho Lima', email: '' }
        ]
      })
      .expect(200);

    const checkout = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true })
      .expect(201);
    const orderId = checkout.body.order.id as string;

    await pay(orderId);

    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const cards = await ctx.prisma.memberCard.findMany({
      where: { orderItem: { orderId } },
      orderBy: { holderName: 'asc' }
    });

    expect(order.status).toBe('DELIVERED');
    expect(cards.map((c) => c.holderName)).toEqual(['Ana Compradora Lima', 'Rui Filho Lima']);
    expect(cards[0]?.holderUserId).toBe(buyer.id);
    expect(cards[1]?.holderUserId).toBeNull();

    // O comprador vê as duas: a própria e a comprada para o filho (sem conta).
    const mine = await ctx.http().get('/api/v1/me/cards').set(auth(buyer.token)).expect(200);
    const ids = mine.body.cards.map((c: { id: string }) => c.id);

    expect(ids).toEqual(expect.arrayContaining(cards.map((c) => c.id)));
  });

  it('renovar soma ao período; estornar a renovação volta a data e cancela as novas', async () => {
    const rui = await ctx.prisma.memberCard.findFirstOrThrow({
      where: { holderName: 'Rui Filho Lima', purchasedByUserId: buyer.id }
    });
    const before = rui.endsOn?.toISOString().slice(0, 10);
    const cart = await setQuantity(1);

    await ctx
      .http()
      .put(`/api/v1/cart/items/${cart.body.lines[0].id}/beneficiaries`)
      .set(auth(buyer.token))
      .send({ beneficiaries: [{ name: 'qualquer', cardId: rui.id }] })
      .expect(200)
      .then((res) => expect(res.body.lines[0].beneficiaries[0].name).toBe('Rui Filho Lima'));

    const checkout = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({ customerPhone: '68 99999-1111', acceptTerms: true })
      .expect(201);
    const renewal = checkout.body.order.id as string;

    await pay(renewal);

    const renewed = await ctx.prisma.memberCard.findUniqueOrThrow({ where: { id: rui.id } });
    const expected = new Date(`${before}T00:00:00Z`);

    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(renewed.endsOn?.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));

    await ctx
      .http()
      .put(`/api/v1/store/orders/${renewal}/status`)
      .set(auth(board.token))
      .send({ status: 'REFUNDED', reason: 'Desistência dentro de 7 dias' })
      .expect(200);

    const reverted = await ctx.prisma.memberCard.findUniqueOrThrow({ where: { id: rui.id } });

    expect(reverted.endsOn?.toISOString().slice(0, 10)).toBe(before);
    expect(reverted.status).toBe('ACTIVE');
  });

  it('não renova carteirinha de outra pessoa', async () => {
    const stranger = await tokenFor(ctx, ['user']);
    const card = await ctx.prisma.memberCard.findFirstOrThrow({
      where: { purchasedByUserId: buyer.id }
    });

    await ctx
      .http()
      .put('/api/v1/cart/items')
      .set(auth(stranger.token))
      .send({ variantId, quantity: 1 })
      .expect(200)
      .then(async (res) => {
        await ctx
          .http()
          .put(`/api/v1/cart/items/${res.body.lines[0].id}/beneficiaries`)
          .set(auth(stranger.token))
          .send({ beneficiaries: [{ name: 'Outra Pessoa', cardId: card.id }] })
          .expect(422);
      });
  });

  it('afiliações abertas: aparece na loja e o aviso a todos sai uma vez só', async () => {
    const list = await ctx.http().get('/api/v1/public/products?membership=true').expect(200);

    expect(list.body.data.map((p: { id: string }) => p.id)).toContain(productId);

    const sent = await ctx
      .http()
      .post(`/api/v1/store/products/${productId}/announce-membership`)
      .set(auth(board.token))
      .expect(200);

    expect(sent.body.notified).toBeGreaterThan(0);
    await expect(
      ctx.prisma.notification.count({
        where: { userId: buyer.id, type: 'announcement.membership' }
      })
    ).resolves.toBe(1);
    await ctx
      .http()
      .post(`/api/v1/store/products/${productId}/announce-membership`)
      .set(auth(board.token))
      .expect(409);
  });
});
