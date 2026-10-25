import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { todayIn } from '../src/common/domain/civil-date';
import { createTestContext, PNG_1X1, randomCnpj, type TestContext, tokenFor } from './helpers';

describe('Fase 6 — parceiros e profissionais', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  const hour = 3_600_000;
  const today = todayIn();
  const shiftDay = (days: number) =>
    new Date(Date.parse(`${today}T12:00:00Z`) + days * 24 * hour).toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Parceiros ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function activePartner(body: Record<string, unknown> = {}) {
    const created = await ctx
      .http()
      .post('/api/v1/partners')
      .set(auth(board.token))
      .send({
        legalName: `Parceiro ${randomUUID().slice(0, 6)} LTDA`,
        displayName: `Parceiro ${randomUUID().slice(0, 6)}`,
        type: 'STORE',
        contractStartsOn: shiftDay(-10),
        commissionType: 'PERCENTAGE',
        commissionPercentage: '10',
        ...body
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/partners/${created.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return created.body.id as string;
  }

  async function partnerProduct(partnerId: string, price: string, extra: object = {}) {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Produto parceiro ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType: 'MADE_TO_ORDER',
        basePrice: price,
        partnerId,
        ...extra
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${product.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return { id: product.body.id as string, variantId: product.body.variants[0].id as string };
  }

  async function buyAndPay(variantId: string, quantity: number) {
    const agent = request.agent(ctx.app.getHttpServer());

    await agent.put('/api/v1/cart/items').send({ variantId, quantity }).expect(200);

    const order = await agent
      .post('/api/v1/orders/checkout')
      .send({
        customerName: 'Cliente Parceiro',
        customerEmail: `p-${randomUUID().slice(0, 6)}@exemplo.test`,
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

  async function account(): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Conta P ${randomUUID().slice(0, 5)}`, type: 'BANK' })
      .expect(201);

    return created.body.id as string;
  }

  it('publishes and sells only active partners within the contract, with restricted documents', async () => {
    const cnpj = randomCnpj();
    const pending = await ctx
      .http()
      .post('/api/v1/partners')
      .set(auth(board.token))
      .send({
        legalName: 'Clínica Exemplo LTDA',
        displayName: `Clínica ${randomUUID().slice(0, 5)}`,
        type: 'PROFESSIONAL',
        documentNumber: cnpj
      })
      .expect(201);
    const id = pending.body.id as string;

    expect(pending.body.status).toBe('PENDING');
    expect(pending.body.documentNumberMasked).toMatch(/^\*+\d{4}$/);

    const stored = await ctx.prisma.partner.findUniqueOrThrow({ where: { id } });

    expect(stored.documentNumberEncrypted).not.toContain(cnpj.slice(0, 8));

    const publicIds = async () =>
      ((await ctx.http().get('/api/v1/public/partners').expect(200)).body as { id: string }[]).map(
        (p) => p.id
      );

    expect(await publicIds()).not.toContain(id);
    await ctx.http().get(`/api/v1/public/partners/${id}`).expect(404);

    const noContract = await ctx
      .http()
      .put(`/api/v1/partners/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(422);

    expect(noContract.body.code).toBe('CONTRACT_REQUIRED');

    await ctx
      .http()
      .patch(`/api/v1/partners/${id}`)
      .set(auth(board.token))
      .send({ contractStartsOn: shiftDay(-30) })
      .expect(200);
    await ctx
      .http()
      .put(`/api/v1/partners/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    expect(await publicIds()).toContain(id);

    // Documento confidencial: diretoria lê; usuário comum não; listagem não expõe.
    const withDoc = await ctx
      .http()
      .post(`/api/v1/partners/${id}/documents`)
      .set(auth(board.token))
      .field('documentType', 'Contrato')
      .attach('file', PNG_1X1, 'contrato.png')
      .expect(201);
    const documentId = withDoc.body.documents[0].id as string;
    const mediaId = (
      await ctx.prisma.partnerDocument.findUniqueOrThrow({ where: { id: documentId } })
    ).mediaFileId;
    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .get(`/api/v1/partners/${id}/documents/${documentId}/file`)
      .set(auth(board.token))
      .expect(200);
    await ctx
      .http()
      .get(`/api/v1/partners/${id}/documents/${documentId}/file`)
      .set(auth(user.token))
      .expect(403);
    await ctx.http().get(`/api/v1/media/${mediaId}`).expect(404);
    await ctx.http().get(`/api/v1/partners/${id}`).set(auth(user.token)).expect(403);

    const list = await ctx
      .http()
      .get(`/api/v1/partners?search=${encodeURIComponent(pending.body.displayName)}`)
      .set(auth(board.token))
      .expect(200);

    expect(list.body.data[0].documents).toBeUndefined();

    // Vigência vencida: some do site e o produto deixa de ser vendido.
    const product = await partnerProduct(id, '50.00');

    await ctx
      .http()
      .patch(`/api/v1/partners/${id}`)
      .set(auth(board.token))
      .send({ contractEndsOn: shiftDay(-1) })
      .expect(200);

    expect(await publicIds()).not.toContain(id);

    const cart = await request
      .agent(ctx.app.getHttpServer())
      .put('/api/v1/cart/items')
      .send({ variantId: product.variantId, quantity: 1 });

    expect(cart.status).toBe(409);
  });

  it('freezes the commission rule on each order item, with product override', async () => {
    const partnerId = await activePartner();
    const byPartner = await partnerProduct(partnerId, '100.00');
    const overridden = await partnerProduct(partnerId, '40.00', {
      commissionTypeOverride: 'FIXED',
      commissionFixedOverride: '5.00'
    });
    const first = await buyAndPay(byPartner.variantId, 2);
    const second = await buyAndPay(overridden.variantId, 3);

    const item1 = await ctx.prisma.orderItem.findFirstOrThrow({ where: { orderId: first } });
    const item2 = await ctx.prisma.orderItem.findFirstOrThrow({ where: { orderId: second } });

    expect(item1.partnerId).toBe(partnerId);
    expect(item1.commissionTypeSnapshot).toBe('PERCENTAGE');
    expect(item1.commissionRateSnapshot?.toFixed(2)).toBe('10.00');
    expect(item1.partnerAmountSnapshot?.toFixed(2)).toBe('180.00');
    expect(item2.commissionTypeSnapshot).toBe('FIXED');
    expect(item2.partnerAmountSnapshot?.toFixed(2)).toBe('105.00');

    // Mudar a regra depois não altera itens já vendidos.
    await ctx
      .http()
      .patch(`/api/v1/partners/${partnerId}`)
      .set(auth(board.token))
      .send({ commissionPercentage: '50' })
      .expect(200);

    const report = await ctx
      .http()
      .get(`/api/v1/partners/sales-report?from=${today}&to=${today}&partnerId=${partnerId}`)
      .set(auth(board.token))
      .expect(200);

    expect(report.body.lines[0].gross.amount).toBe('320.00');
    expect(report.body.lines[0].teamRevenue.amount).toBe('35.00');
    expect(report.body.lines[0].partnerAmount.amount).toBe('285.00');
  });

  it('settles paid items once and posts a single expense in the cash book', async () => {
    const partnerId = await activePartner({ commissionPercentage: '20' });
    const product = await partnerProduct(partnerId, '75.00');
    const orderId = await buyAndPay(product.variantId, 2);
    const createKey = key();
    const settlement = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(createKey)
      .send({ periodStart: today, periodEnd: today })
      .expect(201);
    const id = settlement.body.id as string;

    expect(settlement.body.status).toBe('DRAFT');
    expect(settlement.body.grossSalesAmount.amount).toBe('150.00');
    expect(settlement.body.commissionAmount.amount).toBe('30.00');
    expect(settlement.body.netPayableAmount.amount).toBe('120.00');
    expect(settlement.body.items).toHaveLength(1);

    // Mesma chave devolve o mesmo repasse; outra chave não encontra itens livres.
    const replay = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(createKey)
      .send({ periodStart: today, periodEnd: today })
      .expect(201);

    expect(replay.body.id).toBe(id);

    const again = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(key())
      .send({ periodStart: today, periodEnd: today })
      .expect(422);

    expect(again.body.code).toBe('NOTHING_TO_SETTLE');

    // Pedido em repasse aberto não pode ser estornado.
    const blocked = await ctx
      .http()
      .put(`/api/v1/store/orders/${orderId}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Teste de bloqueio' })
      .expect(409);

    expect(blocked.body.code).toBe('IN_PARTNER_SETTLEMENT');

    const accountId = await account();
    const premature = await ctx
      .http()
      .post(`/api/v1/settlements/${id}/pay`)
      .set(auth(board.token))
      .set(key())
      .send({ accountId, paidOn: today })
      .expect(409);

    expect(premature.body.code).toBe('INVALID_TRANSITION');

    for (const status of ['PENDING', 'APPROVED']) {
      await ctx
        .http()
        .put(`/api/v1/settlements/${id}/status`)
        .set(auth(board.token))
        .send({ status })
        .expect(200);
    }

    const paid = await ctx
      .http()
      .post(`/api/v1/settlements/${id}/pay`)
      .set(auth(board.token))
      .set(key())
      .send({ accountId, paidOn: today })
      .expect(200);

    expect(paid.body.status).toBe('PAID');
    expect(paid.body.transactionId).toBeTruthy();

    await ctx
      .http()
      .post(`/api/v1/settlements/${id}/pay`)
      .set(auth(board.token))
      .set(key())
      .send({ accountId, paidOn: today })
      .expect(200);

    const transactions = await ctx.prisma.financialTransaction.findMany({
      where: { partnerSettlementId: id },
      include: { category: true }
    });

    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.direction).toBe('EXPENSE');
    expect(transactions[0]?.origin).toBe('PARTNER_SETTLEMENT');
    expect(transactions[0]?.amount.toFixed(2)).toBe('120.00');
    expect(transactions[0]?.category.code).toBe('repasses-parceiros');

    const report = await ctx
      .http()
      .get(`/api/v1/partners/sales-report?from=${today}&to=${today}&partnerId=${partnerId}`)
      .set(auth(board.token))
      .expect(200);

    expect(report.body.lines[0].paidOutAmount.amount).toBe('120.00');
    expect(report.body.lines[0].pendingAmount.amount).toBe('0.00');
  });

  it('releases items when an unpaid settlement is cancelled', async () => {
    const partnerId = await activePartner();
    const product = await partnerProduct(partnerId, '30.00');

    await buyAndPay(product.variantId, 1);

    const first = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(key())
      .send({ periodStart: today, periodEnd: today })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/settlements/${first.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/settlements/${first.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED', reason: 'Período errado' })
      .expect(200);

    const second = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(key())
      .send({ periodStart: today, periodEnd: today, adjustmentAmount: '-2.00' })
      .expect(422);

    expect(second.body.code).toBe('REASON_REQUIRED');

    const third = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/settlements`)
      .set(auth(board.token))
      .set(key())
      .send({
        periodStart: today,
        periodEnd: today,
        adjustmentAmount: '-2.00',
        adjustmentReason: 'Taxa de embalagem'
      })
      .expect(201);

    expect(third.body.netPayableAmount.amount).toBe('25.00');
  });

  it('books appointments only on free slots, without schedule conflicts', async () => {
    const partnerId = await activePartner({ type: 'PROFESSIONAL', commissionType: 'NONE' });
    const professional = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/professionals`)
      .set(auth(board.token))
      .send({
        fullName: 'Fisioterapeuta Teste',
        profession: 'Fisioterapia',
        licenseNumber: 'CREFITO 12345',
        email: `prof-${randomUUID().slice(0, 5)}@exemplo.test`
      })
      .expect(201);
    const professionalId = professional.body.id as string;

    expect(professional.body.hasLicense).toBe(true);

    const service = await ctx
      .http()
      .post(`/api/v1/partners/${partnerId}/services`)
      .set(auth(board.token))
      .send({ name: 'Avaliação postural', durationMinutes: 60, price: '120.00', professionalId })
      .expect(201);
    const serviceId = service.body.id as string;

    await ctx
      .http()
      .put(`/api/v1/partner-services/${serviceId}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const base = Date.now() + 48 * hour;
    const slot = await ctx
      .http()
      .post(`/api/v1/professionals/${professionalId}/availability`)
      .set(auth(board.token))
      .send({
        startsAt: new Date(base).toISOString(),
        endsAt: new Date(base + hour).toISOString()
      })
      .expect(201);
    const overlap = await ctx
      .http()
      .post(`/api/v1/professionals/${professionalId}/availability`)
      .set(auth(board.token))
      .send({
        startsAt: new Date(base + hour / 2).toISOString(),
        endsAt: new Date(base + 2 * hour).toISOString()
      })
      .expect(409);

    expect(overlap.body.code).toBe('AVAILABILITY_OVERLAP');

    const slots = await ctx
      .http()
      .get(`/api/v1/public/partner-services/${serviceId}/slots`)
      .expect(200);

    expect(slots.body.slots.map((s: { id: string }) => s.id)).toContain(slot.body.id);
    expect(slots.body.notice).toContain('saúde');

    const alice = await tokenFor(ctx, ['user']);
    const bob = await tokenFor(ctx, ['user']);
    const requested = await ctx
      .http()
      .post('/api/v1/appointments')
      .set(auth(alice.token))
      .send({ serviceId, availabilityId: slot.body.id, notes: 'Prefiro contato por WhatsApp' })
      .expect(201);
    const appointmentId = requested.body.id as string;

    expect(requested.body.status).toBe('REQUESTED');
    expect(requested.body.quotedPrice.amount).toBe('120.00');

    const taken = await ctx
      .http()
      .post('/api/v1/appointments')
      .set(auth(bob.token))
      .send({ serviceId, availabilityId: slot.body.id })
      .expect(409);

    expect(taken.body.code).toBe('SLOT_UNAVAILABLE');
    await ctx.http().get('/api/v1/appointments').set(auth(bob.token)).expect(403);

    const confirmed = await ctx
      .http()
      .put(`/api/v1/appointments/${appointmentId}/status`)
      .set(auth(board.token))
      .send({ status: 'CONFIRMED' })
      .expect(200);

    expect(confirmed.body.status).toBe('CONFIRMED');

    const early = await ctx
      .http()
      .put(`/api/v1/appointments/${appointmentId}/status`)
      .set(auth(board.token))
      .send({ status: 'COMPLETED' })
      .expect(409);

    expect(early.body.code).toBe('NOT_STARTED');

    const notified = await ctx.prisma.notification.count({
      where: { userId: alice.id, type: 'appointment.status' }
    });

    expect(notified).toBe(1);

    // Cancelamento pelo próprio solicitante libera o horário para outra pessoa.
    await ctx
      .http()
      .post(`/api/v1/me/appointments/${appointmentId}/cancel`)
      .set(auth(bob.token))
      .send({ reason: 'Não é meu' })
      .expect(404);
    await ctx
      .http()
      .post(`/api/v1/me/appointments/${appointmentId}/cancel`)
      .set(auth(alice.token))
      .send({ reason: 'Imprevisto' })
      .expect(200);

    const rebooked = await ctx
      .http()
      .post('/api/v1/appointments')
      .set(auth(bob.token))
      .send({ serviceId, availabilityId: slot.body.id })
      .expect(201);

    expect(rebooked.body.status).toBe('REQUESTED');

    const mine = await ctx.http().get('/api/v1/me/appointments').set(auth(alice.token)).expect(200);

    expect(mine.body[0].status).toBe('CANCELLED');
    expect(mine.body[0].requester.email).toBeUndefined();
  });

  it('requires an approved partner for professionals and services', async () => {
    const pending = await ctx
      .http()
      .post('/api/v1/partners')
      .set(auth(board.token))
      .send({ legalName: 'Pendente LTDA', displayName: 'Pendente', type: 'PROFESSIONAL' })
      .expect(201);
    const denied = await ctx
      .http()
      .post(`/api/v1/partners/${pending.body.id}/professionals`)
      .set(auth(board.token))
      .send({ fullName: 'Pessoa', profession: 'Nutrição' })
      .expect(409);

    expect(denied.body.code).toBe('PARTNER_NOT_APPROVED');

    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .post('/api/v1/partners')
      .set(auth(user.token))
      .send({ legalName: 'X LTDA', displayName: 'X', type: 'OTHER' })
      .expect(403);
  });
});
