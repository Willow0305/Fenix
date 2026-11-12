import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { todayIn } from '../src/common/domain/civil-date';
import { createTestContext, type TestContext, tokenFor } from './helpers';

/**
 * Venda de parceiro estornada depois do repasse pago (PEN-052, DT-111): aparece como
 * sugestão de desconto e é descontada uma única vez no repasse seguinte.
 */
describe('Recuperação de venda estornada depois do repasse', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  const today = todayIn();

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Recuperação ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function account(): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Conta R ${randomUUID().slice(0, 5)}`, type: 'BANK' })
      .expect(201);

    return created.body.id as string;
  }

  /** Parceiro ativo com 10% de comissão e um produto dele com o preço informado. */
  async function partnerWithProduct(
    price: string
  ): Promise<{ partnerId: string; variantId: string }> {
    const partner = await ctx
      .http()
      .post('/api/v1/partners')
      .set(auth(board.token))
      .send({
        legalName: `Parceiro ${randomUUID().slice(0, 6)} LTDA`,
        displayName: `Parceiro ${randomUUID().slice(0, 6)}`,
        type: 'STORE',
        contractStartsOn: today,
        commissionType: 'PERCENTAGE',
        commissionPercentage: '10'
      })
      .expect(201);
    const partnerId = partner.body.id as string;

    await ctx
      .http()
      .put(`/api/v1/partners/${partnerId}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Produto recuperação ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: price,
        partnerId
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id as string}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return { partnerId, variantId: product.body.variants[0].id as string };
  }

  async function buyAndPay(variantId: string, quantity = 1): Promise<string> {
    const agent = request.agent(ctx.app.getHttpServer());

    await agent.put('/api/v1/cart/items').send({ variantId, quantity }).expect(200);

    const order = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Cliente Recuperação',
        customerEmail: `r-${randomUUID().slice(0, 6)}@exemplo.test`,
        customerPhone: '68 99999-4444',
        acceptTerms: true
      })
      .expect(201);
    const orderId = order.body.order.id as string;
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/store/orders/${orderId}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: today, accountId: await account() })
      .expect(201);

    return orderId;
  }

  function createSettlement(partnerId: string, body: Record<string, unknown> = {}) {
    return ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(key())
      .send({ periodStart: today, periodEnd: today, ...body });
  }

  async function payPending(partnerId: string): Promise<void> {
    const created = await createSettlement(partnerId).expect(201);
    const id = created.body.id as string;

    for (const status of ['PENDING', 'APPROVED']) {
      await ctx
        .http()
        .put(`/api/v1/settlements/${id}/status`)
        .set(auth(board.token))
        .send({ status })
        .expect(200);
    }

    await ctx
      .http()
      .post(`/api/v1/settlements/${id}/pay`)
      .set(auth(board.token))
      .set(key())
      .send({ accountId: await account(), paidOn: today })
      .expect(200);
  }

  function recoverable(partnerId: string) {
    return ctx
      .http()
      .get(`/api/v1/partners/${partnerId}/settlements/recoverable`)
      .set(auth(board.token))
      .expect(200);
  }

  it('sugere a venda estornada e a desconta uma única vez', async () => {
    const { partnerId, variantId } = await partnerWithProduct('50.00');
    const refundedOrder = await buyAndPay(variantId);

    await payPending(partnerId);
    expect((await recoverable(partnerId)).body).toEqual([]);

    // Repasse já pago: o pedido pode ser cancelado, e a venda vira sugestão de desconto.
    await ctx
      .http()
      .put(`/api/v1/store/orders/${refundedOrder}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Cliente desistiu da compra' })
      .expect(200);

    const suggestions = (await recoverable(partnerId)).body as Array<{
      settlementItemId: string;
      orderId: string;
      amount: { amount: string };
    }>;

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.orderId).toBe(refundedOrder);
    expect(suggestions[0]?.amount.amount).toBe('45.00');

    const itemId = suggestions[0]?.settlementItemId ?? '';

    // Nova venda de 100,00 (90,00 do parceiro) com o desconto de 45,00.
    await buyAndPay(variantId, 2);

    const withRecovery = await createSettlement(partnerId, { recoverItemIds: [itemId] }).expect(
      201
    );

    expect(withRecovery.body.adjustmentAmount.amount).toBe('-45.00');
    expect(withRecovery.body.netPayableAmount.amount).toBe('45.00');
    expect(withRecovery.body.adjustmentReason).toBe(
      'Desconto de 1 venda estornada depois do repasse (R$ 45,00)'
    );
    expect(withRecovery.body.recoveries).toHaveLength(1);
    expect(withRecovery.body.recoveries[0].orderId).toBe(refundedOrder);
    expect((await recoverable(partnerId)).body).toEqual([]);

    // Cancelado o repasse que descontou, a venda volta a ser sugerida.
    await ctx
      .http()
      .put(`/api/v1/settlements/${withRecovery.body.id as string}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Refazer com o frete' })
      .expect(200);
    expect((await recoverable(partnerId)).body).toHaveLength(1);

    const redo = await createSettlement(partnerId, {
      recoverItemIds: [itemId],
      adjustmentAmount: '5.00',
      adjustmentReason: 'Frete combinado'
    }).expect(201);

    expect(redo.body.adjustmentAmount.amount).toBe('-40.00');
    expect(redo.body.netPayableAmount.amount).toBe('50.00');
    expect(redo.body.adjustmentReason).toBe(
      'Frete combinado · Desconto de 1 venda estornada depois do repasse (R$ 45,00)'
    );

    // A mesma venda não é descontada de novo.
    await buyAndPay(variantId);

    const twice = await createSettlement(partnerId, { recoverItemIds: [itemId] }).expect(409);

    expect(twice.body.code).toBe('RECOVERY_UNAVAILABLE');

    // O banco recusa alterar ou apagar a recuperação (registro financeiro).
    await expect(
      ctx.prisma.partnerSettlementRecovery.deleteMany({ where: { settlementItemId: itemId } })
    ).rejects.toThrow();
  });

  it('recusa desconto maior que o repasse e não aceita venda de outro parceiro', async () => {
    const first = await partnerWithProduct('200.00');
    const order = await buyAndPay(first.variantId);

    await payPending(first.partnerId);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${order}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Produto com defeito' })
      .expect(200);

    const [suggestion] = (await recoverable(first.partnerId)).body as Array<{
      settlementItemId: string;
    }>;
    const itemId = suggestion?.settlementItemId ?? '';

    // Venda nova de 20,00 (18,00 do parceiro) não cobre o desconto de 180,00.
    const small = await partnerWithProduct('20.00');

    await buyAndPay(small.variantId);

    const otherPartner = await createSettlement(small.partnerId, {
      recoverItemIds: [itemId]
    }).expect(409);

    expect(otherPartner.body.code).toBe('RECOVERY_UNAVAILABLE');

    const cheap = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Produto barato ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: '20.00',
        partnerId: first.partnerId
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${cheap.body.id as string}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await buyAndPay(cheap.body.variants[0].id as string);

    const negative = await createSettlement(first.partnerId, { recoverItemIds: [itemId] }).expect(
      422
    );

    expect(negative.body.code).toBe('NEGATIVE_SETTLEMENT');
    expect(negative.body.detail).toContain('Desmarque alguma');
    // Continua disponível para o próximo repasse.
    expect((await recoverable(first.partnerId)).body).toHaveLength(1);
  });

  it('só a diretoria com settlements.manage vê as sugestões', async () => {
    const user = await tokenFor(ctx, ['user']);
    const { partnerId } = await partnerWithProduct('10.00');

    await ctx
      .http()
      .get(`/api/v1/partners/${partnerId}/settlements/recoverable`)
      .set(auth(user.token))
      .expect(403);
  });
});
