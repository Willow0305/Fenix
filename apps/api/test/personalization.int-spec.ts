import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Produtos personalizados (DT-069)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const key = () => ({ 'Idempotency-Key': `test-${randomUUID()}` });
  const customer = {
    customerName: 'Torcedora Teste',
    customerEmail: 'torcedora@exemplo.test',
    customerPhone: '68 99999-2222',
    acceptTerms: true
  };

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    categoryId = (
      await ctx
        .http()
        .post('/api/v1/store/categories')
        .set(auth(board.token))
        .send({ name: `Camisas ${randomUUID().slice(0, 4)}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Camisa com tamanho/modelo e campos "Nome na camisa" (R$ 15) e "Número". */
  async function shirt(fulfillmentType: 'MADE_TO_ORDER' | 'CAMPAIGN' = 'MADE_TO_ORDER') {
    const product = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Camisa personalizada ${randomUUID().slice(0, 5)}`,
        categoryId,
        fulfillmentType,
        basePrice: '100.00',
        sizeGuide: 'P: 50 cm de largura; M: 53 cm.'
      })
      .expect(201);
    const id = product.body.id as string;

    await ctx
      .http()
      .post(`/api/v1/store/products/${id}/variants`)
      .set(auth(board.token))
      .send({ name: 'M tradicional', size: 'M', model: 'Tradicional', color: 'Vermelha' })
      .expect(201);
    await ctx
      .http()
      .post(`/api/v1/store/products/${id}/personalization-fields`)
      .set(auth(board.token))
      .send({
        label: 'Nome na camisa',
        kind: 'TEXT',
        required: true,
        maxLength: 12,
        extraPrice: '15.00'
      })
      .expect(201);

    const detail = await ctx
      .http()
      .post(`/api/v1/store/products/${id}/personalization-fields`)
      .set(auth(board.token))
      .send({ label: 'Número', kind: 'NUMBER', minValue: 0, maxValue: 99, sortOrder: 1 })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/store/products/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const fields = detail.body.personalizationFields as { id: string; label: string }[];

    return {
      id,
      slug: detail.body.slug as string,
      variantId: (detail.body.variants as { id: string; model: string | null }[]).find(
        (v) => v.model === 'Tradicional'
      )?.id as string,
      nome: fields.find((f) => f.label === 'Nome na camisa')?.id as string,
      numero: fields.find((f) => f.label === 'Número')?.id as string
    };
  }

  it('cada personalização é uma linha, com acréscimo no preço, editável até fechar', async () => {
    const p = await shirt();
    const agent = request.agent(ctx.app.getHttpServer());
    const put = (personalization: Record<string, string>, quantity = 1) =>
      agent.put('/api/v1/cart/items').send({ variantId: p.variantId, quantity, personalization });

    await put({ [p.numero]: '10' }).expect(422);
    await put({ [p.nome]: 'ana', [p.numero]: '10' }).expect(200);

    let cart = (await put({ [p.nome]: 'bia', [p.numero]: '7' }).expect(200)).body;

    expect(cart.lines).toHaveLength(2);
    expect(cart.lines[0].unitPrice.amount).toBe('115.00');
    expect(cart.lines[0].personalization).toEqual([
      expect.objectContaining({ label: 'Nome na camisa', value: 'ANA' }),
      expect.objectContaining({ label: 'Número', value: '10' })
    ]);

    // Editar "BIA 7" para "ANA 10" junta com a linha igual.
    const bia = cart.lines.find((l: { personalizationValues: Record<string, string> }) =>
      Object.values(l.personalizationValues).includes('BIA')
    );

    cart = (
      await agent
        .put(`/api/v1/cart/items/${bia.id}/personalization`)
        .send({ values: { [p.nome]: 'Ana', [p.numero]: '10' } })
        .expect(200)
    ).body;
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(2);

    await agent.post('/api/v1/orders/checkout').send(customer).expect(422);

    const done = await agent
      .post('/api/v1/orders/checkout')
      .send({ ...customer, acceptPersonalized: true })
      .expect(201);

    expect(done.body.order.items[0].personalization).toEqual([
      { label: 'Nome na camisa', value: 'ANA' },
      { label: 'Número', value: '10' }
    ]);
    expect(done.body.order.totalAmount.amount).toBe('230.00');

    // Mudar o campo depois não altera o pedido (cópia travada).
    await ctx
      .http()
      .patch(`/api/v1/store/personalization-fields/${p.nome}`)
      .set(auth(board.token))
      .send({ label: 'Apelido', extraPrice: '20.00' })
      .expect(200);

    const order = await ctx
      .http()
      .get(`/api/v1/store/orders/${done.body.order.id}`)
      .set(auth(board.token))
      .expect(200);

    expect(order.body.items[0].personalization[0].label).toBe('Nome na camisa');
  });

  it('a planilha de produção da remessa traz tamanho, modelo, cor, nome e número', async () => {
    const p = await shirt('CAMPAIGN');
    const campaign = await ctx
      .http()
      .post('/api/v1/campaigns')
      .set(auth(board.token))
      .send({
        name: `Remessa personalizada ${randomUUID().slice(0, 4)}`,
        salesStartAt: new Date(Date.now() - 3_600_000).toISOString(),
        salesEndAt: new Date(Date.now() + 86_400_000).toISOString()
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/campaigns/${campaign.body.id}/products`)
      .set(auth(board.token))
      .send({ productId: p.id })
      .expect(200);
    await ctx
      .http()
      .put(`/api/v1/campaigns/${campaign.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'OPEN' })
      .expect(200);

    const agent = request.agent(ctx.app.getHttpServer());

    await agent
      .put('/api/v1/cart/items')
      .send({
        variantId: p.variantId,
        quantity: 1,
        personalization: { [p.nome]: 'Caio', [p.numero]: '9' }
      })
      .expect(200);

    const order = await agent
      .post('/api/v1/orders/checkout')
      .send({ ...customer, acceptPersonalized: true })
      .expect(201);
    const pix = await ctx.prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'pix' } });
    const account = await ctx
      .http()
      .post('/api/v1/finance/accounts')
      .set(auth(board.token))
      .send({ name: `Remessa ${randomUUID().slice(0, 4)}`, type: 'BANK' })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/store/orders/${order.body.order.id}/payments`)
      .set(auth(board.token))
      .set(key())
      .send({ paymentMethodId: pix.id, paidOn: '2026-10-20', accountId: account.body.id })
      .expect(201);

    const csv = await ctx
      .http()
      .get(`/api/v1/campaigns/${campaign.body.id}/report.csv?kind=production`)
      .set(auth(board.token))
      .expect(200);
    const [header, row] = csv.text
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/);

    expect(header).toContain('Tamanho');
    expect(header).toContain('Nome na camisa');
    expect(row).toContain('M');
    expect(row).toContain('Tradicional');
    expect(row).toContain('CAIO');

    const supplier = await ctx
      .http()
      .get(`/api/v1/campaigns/${campaign.body.id}/report.csv?kind=supplier`)
      .set(auth(board.token))
      .expect(200);

    expect(supplier.text).toContain('Tamanho');
  });

  it('só a diretoria cadastra campos; produto mostra guia de medidas', async () => {
    const p = await shirt();
    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .post(`/api/v1/store/products/${p.id}/personalization-fields`)
      .set(auth(user.token))
      .send({ label: 'X', kind: 'TEXT' })
      .expect(403);

    const pub = await ctx.http().get(`/api/v1/public/products/${p.slug}`).expect(200);

    expect(pub.body).toMatchObject({
      isPersonalized: true,
      sizeGuide: expect.stringContaining('50 cm')
    });
    expect(pub.body.variants).toEqual(
      expect.arrayContaining([expect.objectContaining({ size: 'M', model: 'Tradicional' })])
    );
  });
});
