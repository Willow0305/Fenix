import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Assuntos de notícias em lista controlada pela diretoria (D8, DT-081). */
describe('Assuntos de notícias (D8, DT-081)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('só a diretoria mantém a lista; notícia usa só assuntos ativos; filtro público', async () => {
    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .post('/api/v1/news-tags')
      .set(auth(user.token))
      .send({ name: `Seleção ${tag}` })
      .expect(403);

    const selecao = await ctx
      .http()
      .post('/api/v1/news-tags')
      .set(auth(board.token))
      .send({ name: `Seleção ${tag}` })
      .expect(201);
    const base = await ctx
      .http()
      .post('/api/v1/news-tags')
      .set(auth(board.token))
      .send({ name: `Base ${tag}` })
      .expect(201);

    await ctx
      .http()
      .post('/api/v1/news-tags')
      .set(auth(board.token))
      .send({ name: `seleção ${tag}` })
      .expect(409);

    const categoryId = (
      await ctx
        .http()
        .post('/api/v1/news-categories')
        .set(auth(board.token))
        .send({ name: `Assuntos ${tag}` })
        .expect(201)
    ).body.id as string;
    const news = await ctx
      .http()
      .post('/api/v1/news')
      .set(auth(board.token))
      .send({
        title: `Convocação ${tag}`,
        categoryId,
        content: 'Texto da convocação da seleção.',
        tagIds: [selecao.body.id, base.body.id]
      })
      .expect(201);

    expect(news.body.tags.map((t: { slug: string }) => t.slug).sort()).toEqual(
      [base.body.slug, selecao.body.slug].sort()
    );

    await ctx
      .http()
      .post(`/api/v1/news/${news.body.id}/publish`)
      .set(auth(board.token))
      .send({})
      .expect(200);

    const filtered = await ctx
      .http()
      .get(`/api/v1/public/news?tag=${selecao.body.slug}`)
      .expect(200);

    expect(filtered.body.data.map((n: { id: string }) => n.id)).toEqual([news.body.id]);

    // Assunto inativo some da notícia e do filtro, e não pode ser escolhido de novo.
    await ctx
      .http()
      .patch(`/api/v1/news-tags/${base.body.id}`)
      .set(auth(board.token))
      .send({ isActive: false })
      .expect(200);

    const detail = await ctx.http().get(`/api/v1/public/news/${news.body.slug}`).expect(200);

    expect(detail.body.tags.map((t: { id: string }) => t.id)).toEqual([selecao.body.id]);
    await ctx
      .http()
      .patch(`/api/v1/news/${news.body.id}`)
      .set(auth(board.token))
      .send({ tagIds: [base.body.id] })
      .expect(422);

    // Em uso, não exclui (inativar é o caminho); sem uso, exclui.
    await ctx
      .http()
      .delete(`/api/v1/news-tags/${selecao.body.id}`)
      .set(auth(board.token))
      .send({ reason: 'Não usamos mais' })
      .expect(409);
    await ctx
      .http()
      .patch(`/api/v1/news/${news.body.id}`)
      .set(auth(board.token))
      .send({ tagIds: [] })
      .expect(200);
    await ctx
      .http()
      .delete(`/api/v1/news-tags/${selecao.body.id}`)
      .set(auth(board.token))
      .send({ reason: 'Não usamos mais' })
      .expect(204);

    const publicTags = await ctx.http().get('/api/v1/public/news-tags').expect(200);

    expect(publicTags.body.map((t: { id: string }) => t.id)).not.toContain(selecao.body.id);
  });
});
