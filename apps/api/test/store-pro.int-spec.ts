import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { createTestContext, PNG_1X1, type TestContext, tokenFor } from './helpers';

/** Loja: fotos ordenadas, troca de opção no carrinho e páginas públicas ao vivo (DT-051). */
describe('Loja — fotos, carrinho e tempo real', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let categoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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

  /** Produto ativo com variações P, M e G; estoque por variação. */
  async function product(stock: Record<string, number>) {
    const created = await ctx
      .http()
      .post('/api/v1/store/products')
      .set(auth(board.token))
      .send({
        name: `Camisa ${randomUUID().slice(0, 6)}`,
        categoryId,
        fulfillmentType: 'STOCK',
        basePrice: '79.90'
      })
      .expect(201);
    const id = created.body.id as string;
    const variants: Record<string, string> = { P: created.body.variants[0].id as string };

    await ctx
      .http()
      .patch(`/api/v1/store/products/${id}/variants/${variants['P']}`)
      .set(auth(board.token))
      .send({ name: 'P' })
      .expect(200);

    for (const name of ['M', 'G']) {
      const detail = await ctx
        .http()
        .post(`/api/v1/store/products/${id}/variants`)
        .set(auth(board.token))
        .send({ name })
        .expect(201);

      variants[name] = (detail.body.variants as { id: string; name: string }[]).find(
        (variant) => variant.name === name
      )?.id as string;
    }

    for (const [name, quantity] of Object.entries(stock).filter(([, q]) => q > 0)) {
      await ctx
        .http()
        .post(`/api/v1/store/variants/${variants[name]}/stock`)
        .set(auth(board.token))
        .send({ type: 'STOCK_IN', quantity, reason: 'Entrada inicial' })
        .expect(201);
    }

    await ctx
      .http()
      .put(`/api/v1/store/products/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE' })
      .expect(200);

    return { id, variants };
  }

  const upload = (productId: string, alt: string) =>
    ctx
      .http()
      .post(`/api/v1/store/products/${productId}/images`)
      .set(auth(board.token))
      .field('altText', alt)
      .attach('file', PNG_1X1, { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);

  describe('fotos do produto', () => {
    it('reordena; a primeira vira capa e a ordem aparece no site', async () => {
      const p = await product({ P: 1 });

      await upload(p.id, 'Frente');
      await upload(p.id, 'Costas');

      const detail = await upload(p.id, 'Detalhe');
      const ids = (detail.body.images as { id: string }[]).map((image) => image.id);
      const reordered = await ctx
        .http()
        .put(`/api/v1/store/products/${p.id}/images/order`)
        .set(auth(board.token))
        .send({ imageIds: [ids[2], ids[0], ids[1]] })
        .expect(200);

      expect(reordered.body.images.map((image: { altText: string }) => image.altText)).toEqual([
        'Detalhe',
        'Frente',
        'Costas'
      ]);
      expect(reordered.body.images[0].isPrimary).toBe(true);
      expect(reordered.body.images.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(
        1
      );

      const slug = reordered.body.slug as string;
      const site = await ctx.http().get(`/api/v1/public/products/${slug}`).expect(200);

      expect(site.body.images.map((image: { altText: string }) => image.altText)).toEqual([
        'Detalhe',
        'Frente',
        'Costas'
      ]);
    });

    it('recusa ordem com foto faltando, repetida ou de outro produto', async () => {
      const p = await product({ P: 1 });
      const other = await product({ P: 1 });

      await upload(p.id, 'A');

      const detail = await upload(p.id, 'B');
      const foreign = (await upload(other.id, 'X')).body.images[0].id as string;
      const [a, b] = (detail.body.images as { id: string }[]).map((image) => image.id);
      const order = (imageIds: unknown[]) =>
        ctx
          .http()
          .put(`/api/v1/store/products/${p.id}/images/order`)
          .set(auth(board.token))
          .send({ imageIds });

      expect((await order([a])).status).toBe(409);
      expect((await order([a, a])).status).toBe(409);
      expect((await order([a, foreign])).status).toBe(409);
      expect((await order([b, a])).status).toBe(200);
    });

    it('edita a descrição da foto e exige permissão', async () => {
      const p = await product({ P: 1 });
      const image = (await upload(p.id, 'Antiga')).body.images[0].id as string;
      const updated = await ctx
        .http()
        .patch(`/api/v1/store/products/${p.id}/images/${image}`)
        .set(auth(board.token))
        .send({ altText: 'Camisa vermelha, frente' })
        .expect(200);

      expect(updated.body.images[0].altText).toBe('Camisa vermelha, frente');

      const member = await tokenFor(ctx, ['user']);

      await ctx
        .http()
        .put(`/api/v1/store/products/${p.id}/images/order`)
        .set(auth(member.token))
        .send({ imageIds: [image] })
        .expect(403);
    });
  });

  describe('carrinho', () => {
    it('mostra as opções com estoque e troca o tamanho mantendo a quantidade', async () => {
      const p = await product({ P: 5, M: 2, G: 0 });
      const agent = request.agent(ctx.app.getHttpServer());

      await agent
        .put('/api/v1/cart/items')
        .send({ variantId: p.variants['P'], quantity: 2 })
        .expect(200);

      const cart = await agent.get('/api/v1/cart').expect(200);

      expect(cart.body.lines[0].options).toEqual([
        { variantId: p.variants['P'], name: 'P', available: 5 },
        { variantId: p.variants['M'], name: 'M', available: 2 },
        { variantId: p.variants['G'], name: 'G', available: 0 }
      ]);

      const changed = await agent
        .post('/api/v1/cart/items/change')
        .send({ fromVariantId: p.variants['P'], toVariantId: p.variants['M'], quantity: 2 })
        .expect(200);

      expect(changed.body.lines).toHaveLength(1);
      expect(changed.body.lines[0]).toMatchObject({ variantName: 'M', quantity: 2 });
    });

    it('sem estoque na nova opção, o item fica como estava', async () => {
      const p = await product({ P: 3, M: 1 });
      const agent = request.agent(ctx.app.getHttpServer());

      await agent
        .put('/api/v1/cart/items')
        .send({ variantId: p.variants['P'], quantity: 2 })
        .expect(200);

      const refused = await agent
        .post('/api/v1/cart/items/change')
        .send({ fromVariantId: p.variants['P'], toVariantId: p.variants['M'], quantity: 2 })
        .expect(409);

      expect(refused.body.code).toBe('INSUFFICIENT_STOCK');

      const cart = await agent.get('/api/v1/cart').expect(200);

      expect(cart.body.lines[0]).toMatchObject({ variantName: 'P', quantity: 2 });
    });

    it('soma quando a nova opção já está no carrinho e recusa opção de outro produto', async () => {
      const p = await product({ P: 5, M: 5 });
      const other = await product({ P: 5 });
      const agent = request.agent(ctx.app.getHttpServer());

      await agent.put('/api/v1/cart/items').send({ variantId: p.variants['P'], quantity: 1 });
      await agent.put('/api/v1/cart/items').send({ variantId: p.variants['M'], quantity: 2 });

      const merged = await agent
        .post('/api/v1/cart/items/change')
        .send({ fromVariantId: p.variants['P'], toVariantId: p.variants['M'], quantity: 1 })
        .expect(200);

      expect(merged.body.lines).toHaveLength(1);
      expect(merged.body.lines[0]).toMatchObject({ variantName: 'M', quantity: 3 });

      const wrong = await agent
        .post('/api/v1/cart/items/change')
        .send({ fromVariantId: p.variants['M'], toVariantId: other.variants['P'], quantity: 1 })
        .expect(422);

      expect(wrong.body.code).toBe('INVALID_OPTION');
    });
  });

  describe('páginas públicas ao vivo', () => {
    let base: string;

    beforeAll(async () => {
      await ctx.app.listen(0, '127.0.0.1');
      base = (await ctx.app.getUrl()).replace('[::1]', '127.0.0.1');
    });

    it('exige assunto válido', async () => {
      expect((await fetch(`${base}/api/v1/public/live?topics=qualquer`)).status).toBe(422);
    });

    it('avisa a página da loja quando o estoque muda, sem login', async () => {
      const controller = new AbortController();
      const response = await fetch(`${base}/api/v1/public/live?topics=store`, {
        signal: controller.signal
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      const read = async () => {
        const deadline = Date.now() + 6_000;

        while (!text.includes('event: catalog')) {
          if (Date.now() > deadline) {
            throw new Error(`Sem evento da loja: ${text}`);
          }

          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          text += decoder.decode(value, { stream: true });
        }
      };

      try {
        expect(response.headers.get('content-type')).toContain('text/event-stream');

        const p = await product({ P: 1 });

        await ctx
          .http()
          .post(`/api/v1/store/variants/${p.variants['P']}/stock`)
          .set(auth(board.token))
          .send({ type: 'STOCK_IN', quantity: 3, reason: 'Reposição' })
          .expect(201);
        await read();

        expect(text).toContain('event: catalog');
      } finally {
        controller.abort();
      }
    });
  });
});
