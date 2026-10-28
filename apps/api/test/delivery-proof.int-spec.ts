import { randomUUID } from 'node:crypto';

import { DeliveryDispatchService } from '../src/modules/store/application/delivery-dispatch.service';
import { createTestContext, PNG_1X1, type TestContext, tokenFor } from './helpers';

/** Comprovante de entrega (DT-075, etapa 2): entregador, código, link, provas e "Não recebi". */
describe('Comprovante de entrega (DT-075)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let buyer: { token: string; id: string };
  let categoryId: string;
  let accountId: string;
  let neighborhoodId: string;
  let zoneId: string;
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });

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
        .send({ name: `Comprovante ${tag}` })
        .expect(201)
    ).body.id;
    accountId = (
      await ctx
        .http()
        .post('/api/v1/finance/accounts')
        .set(auth(board.token))
        .send({ name: `Comprovante ${tag}`, type: 'BANK' })
        .expect(201)
    ).body.id;

    const zone = await ctx
      .http()
      .post('/api/v1/store/delivery/zones')
      .set(auth(board.token))
      .send({ name: `Zona ${tag}`, fee: '10.00', leadDays: 1, neighborhoods: [`Bairro ${tag}`] })
      .expect(201);

    zoneId = zone.body.id;
    neighborhoodId = zone.body.neighborhoods[0].id;
    await ctx
      .http()
      .put('/api/v1/store/delivery/settings')
      .set(auth(board.token))
      .send({ enabled: true, freeMinimum: '' })
      .expect(200);
  });

  afterAll(async () => {
    await ctx
      .http()
      .delete(`/api/v1/store/delivery/zones/${zoneId}`)
      .set(auth(board.token))
      .send({ reason: 'Fim do teste' });
    await ctx
      .http()
      .put('/api/v1/store/delivery/settings')
      .set(auth(board.token))
      .send({ enabled: false });
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Pedido de entrega pago (R$ 100 + R$ 10 de entrega). */
  async function paidDeliveryOrder(): Promise<string> {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Toalha ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '100.00'
      })
      .expect(201);
    const variantId = product.body.variants[0].id as string;

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

    const order = await ctx
      .http()
      .post('/api/v1/orders/checkout')
      .set(auth(buyer.token))
      .send({
        customerPhone: '68 99999-1111',
        acceptTerms: true,
        fulfillment: 'DELIVERY',
        address: { postalCode: '69900000', street: 'Rua A', number: '1', neighborhoodId }
      })
      .expect(201);
    const id = order.body.order.id as string;
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });

    await ctx
      .http()
      .post(`/api/v1/store/orders/${id}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-28', accountId })
      .expect(201);

    return id;
  }

  const dispatch = (id: string, body: Record<string, unknown> = {}) =>
    ctx.http().post(`/api/v1/store/orders/${id}/dispatch`).set(auth(board.token)).send(body);
  const tokenOf = (link: string) => link.split('/entrega/')[1] as string;
  const myOrder = async (id: string) =>
    (await ctx.http().get(`/api/v1/me/orders/${id}`).set(auth(buyer.token)).expect(200)).body;

  it('entregadores: cadastro pela diretoria; só quem cuida de pedidos lista', async () => {
    await ctx.http().get('/api/v1/store/couriers').set(auth(buyer.token)).expect(403);

    const courier = await ctx
      .http()
      .post('/api/v1/store/couriers')
      .set(auth(board.token))
      .send({ name: 'João da Silva', kind: 'OWN_COURIER', vehicle: 'Moto', plate: 'abc1d23' })
      .expect(201);

    expect(courier.body).toMatchObject({ plate: 'ABC1D23', isActive: true });

    const list = await ctx.http().get('/api/v1/store/couriers').set(auth(board.token)).expect(200);

    expect(list.body.map((c: { id: string }) => c.id)).toContain(courier.body.id);
  });

  it('saída: comprador vê código, primeiro nome e placa; o painel nunca vê o código', async () => {
    const id = await paidDeliveryOrder();
    const courier = (
      await ctx
        .http()
        .post('/api/v1/store/couriers')
        .set(auth(board.token))
        .send({
          name: 'Carla Souza',
          kind: 'OWN_COURIER',
          vehicle: 'Moto vermelha',
          plate: 'XYZ9A87'
        })
        .expect(201)
    ).body;
    const out = await dispatch(id, { courierId: courier.id, notes: 'Rota do centro' }).expect(201);

    expect(out.body.link).toMatch(/\/entrega\/[A-Za-z0-9_-]+$/);
    expect(out.body.attempts[0]).toMatchObject({
      status: 'OUT',
      courierName: 'Carla Souza',
      plate: 'XYZ9A87',
      linkActive: true
    });

    const mine = await myOrder(id);

    expect(mine).toMatchObject({
      status: 'OUT_FOR_DELIVERY',
      courier: { firstName: 'Carla', vehicle: 'Moto vermelha', plate: 'XYZ9A87' }
    });
    expect(mine.deliveryCode).toMatch(/^\d{4}$/);

    const admin = await ctx
      .http()
      .get(`/api/v1/store/orders/${id}`)
      .set(auth(board.token))
      .expect(200);

    expect(admin.body.deliveryCode).toBeUndefined();
    expect(JSON.stringify(out.body)).not.toContain(mine.deliveryCode as string);

    // Link do entregador: dados mínimos da entrega, código errado conta, certo entrega.
    const token = tokenOf(out.body.link);
    const view = await ctx.http().get(`/api/v1/public/deliveries/${token}`).expect(200);

    expect(view.body).toMatchObject({
      status: 'OUT',
      customerFirstName: expect.any(String),
      codeAttemptsLeft: 5,
      address: { street: 'Rua A', number: '1', phone: expect.any(String) }
    });
    expect(view.body.address.postalCode).toBeUndefined();

    const wrong = mine.deliveryCode === '0000' ? '1111' : '0000';

    await ctx
      .http()
      .post(`/api/v1/public/deliveries/${token}/code`)
      .send({ code: wrong })
      .expect(422);
    await ctx
      .http()
      .post(`/api/v1/public/deliveries/${token}/code`)
      .send({ code: mine.deliveryCode })
      .expect(200);

    expect(await myOrder(id)).toMatchObject({
      status: 'DELIVERED',
      deliveryProofKind: 'CODE',
      deliveryConfirmedAt: expect.any(String),
      notReceivedUntil: null
    });
    // Depois da entrega o link deixa de valer.
    await ctx.http().get(`/api/v1/public/deliveries/${token}`).expect(404);
  });

  it('código: limite de tentativas; diretoria digita o código passado pelo motoboy', async () => {
    const id = await paidDeliveryOrder();
    const out = await dispatch(id, { courierKind: 'APP', courierName: 'Entregador App' }).expect(
      201
    );
    const token = tokenOf(out.body.link);
    const code = (await myOrder(id)).deliveryCode as string;
    const wrong = code === '0000' ? '1111' : '0000';

    for (let i = 0; i < 5; i += 1) {
      await ctx
        .http()
        .post(`/api/v1/public/deliveries/${token}/code`)
        .send({ code: wrong })
        .expect(422);
    }

    await ctx.http().post(`/api/v1/public/deliveries/${token}/code`).send({ code }).expect(409);

    // Link novo não zera as tentativas da saída: segue só pela diretoria.
    await ctx
      .http()
      .post(`/api/v1/store/orders/${id}/dispatch/link`)
      .set(auth(board.token))
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/store/orders/${id}/delivery-code`)
      .set(auth(board.token))
      .send({ code })
      .expect(409);
  });

  it('foto pelo link do entregador comprova com quem recebeu', async () => {
    const id = await paidDeliveryOrder();
    const out = await dispatch(id).expect(201);
    const token = tokenOf(out.body.link);

    await ctx
      .http()
      .post(`/api/v1/public/deliveries/${token}/photo`)
      .field('receivedBy', 'Maria, mãe')
      .attach('file', PNG_1X1, { filename: 'entrega.png', contentType: 'image/png' })
      .expect(200);

    expect(await myOrder(id)).toMatchObject({
      status: 'DELIVERED',
      deliveryProofKind: 'PHOTO',
      hasDeliveryProof: true
    });

    const attempts = await ctx
      .http()
      .get(`/api/v1/store/orders/${id}/delivery-attempts`)
      .set(auth(board.token))
      .expect(200);

    expect(attempts.body[0]).toMatchObject({
      status: 'DELIVERED',
      receivedBy: 'Maria, mãe',
      hasPhoto: true,
      linkActive: false
    });
  });

  it('só marcada como entregue: "Não recebi" em 3 dias, nova entrega e confirmação automática', async () => {
    const id = await paidDeliveryOrder();

    await dispatch(id).expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(200);

    const marked = await myOrder(id);

    expect(marked).toMatchObject({ deliveryProofKind: 'STAFF_ONLY', deliveryConfirmedAt: null });
    expect(marked.notReceivedUntil).not.toBeNull();

    await ctx
      .http()
      .post(`/api/v1/me/orders/${id}/not-received`)
      .set(auth(buyer.token))
      .send({ note: 'Ninguém entregou nada aqui em casa.' })
      .expect(204);
    await ctx
      .http()
      .post(`/api/v1/me/orders/${id}/not-received`)
      .set(auth(buyer.token))
      .send({ note: 'Avisando de novo, nada chegou.' })
      .expect(409);
    await ctx
      .http()
      .post(`/api/v1/store/orders/${id}/not-received/resolve`)
      .set(auth(board.token))
      .send({ action: 'REDELIVER', reason: 'Vamos levar amanhã cedo.' })
      .expect(200);

    expect(await myOrder(id)).toMatchObject({
      status: 'PROCESSING',
      notReceivedResolution: 'REDELIVER'
    });

    // Segunda saída usa o mesmo código; entregue de novo só pela diretoria.
    const second = await dispatch(id).expect(201);

    expect(second.body.attempts).toHaveLength(2);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(200);

    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id } });

    // Aviso já respondido: a confirmação automática vale para os demais pedidos.
    await ctx.prisma.order.update({
      where: { id },
      data: { notReceivedAt: null, deliveredAt: new Date(Date.now() - 4 * 86_400_000) }
    });

    await ctx.app.get(DeliveryDispatchService).autoConfirm();

    const confirmed = await ctx.prisma.order.findUniqueOrThrow({ where: { id } });

    expect(order.deliveryConfirmedAt).toBeNull();
    expect(confirmed.deliveryConfirmedAt).not.toBeNull();
  });

  it('"Não recebi" com estorno devolve tudo; entrega sem sucesso vira retirada com a taxa devolvida', async () => {
    const refundId = await paidDeliveryOrder();

    await dispatch(refundId).expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${refundId}/status`)
      .set(auth(board.token))
      .send({ status: 'DELIVERED' })
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/me/orders/${refundId}/not-received`)
      .set(auth(buyer.token))
      .send({ note: 'O pacote nunca chegou na portaria.' })
      .expect(204);
    await ctx
      .http()
      .post(`/api/v1/store/orders/${refundId}/not-received/resolve`)
      .set(auth(board.token))
      .send({ action: 'REFUND', reason: 'Pacote extraviado.' })
      .expect(200);

    const refunds = await ctx.prisma.refund.aggregate({
      where: { orderId: refundId },
      _sum: { amount: true }
    });

    expect(refunds._sum.amount?.toFixed(2)).toBe('110.00');
    expect((await myOrder(refundId)).status).toBe('REFUNDED');

    const pickupId = await paidDeliveryOrder();

    await dispatch(pickupId).expect(201);
    await ctx
      .http()
      .put(`/api/v1/store/orders/${pickupId}/status`)
      .set(auth(board.token))
      .send({ status: 'PROCESSING', reason: 'Endereço não encontrado' })
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/store/orders/${pickupId}/switch-to-pickup`)
      .set(auth(board.token))
      .send({ reason: 'Combinado com o comprador.', refundFee: true })
      .expect(200);

    const switched = await myOrder(pickupId);
    const feeRefund = await ctx.prisma.refund.findFirstOrThrow({
      where: { orderId: pickupId },
      include: { payment: { select: { isDeliveryFee: true } } }
    });

    expect(switched.fulfillment).toBe('PICKUP');
    expect(feeRefund.amount.toFixed(2)).toBe('10.00');
    expect(feeRefund.payment.isDeliveryFee).toBe(true);

    const attempts = await ctx
      .http()
      .get(`/api/v1/store/orders/${pickupId}/delivery-attempts`)
      .set(auth(board.token))
      .expect(200);

    expect(attempts.body[0]).toMatchObject({
      status: 'FAILED',
      failureReason: 'Endereço não encontrado'
    });
  });
});
