import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** "Mais lidas" com contagem própria e agregada (D5, DT-081). */
describe('Leituras de notícias (D5, DT-081)', () => {
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

  it('soma leituras por dia sem identificar ninguém e ordena as mais lidas', async () => {
    const categoryId = (
      await ctx
        .http()
        .post('/api/v1/news-categories')
        .set(auth(board.token))
        .send({ name: `Leituras ${tag}` })
        .expect(201)
    ).body.id as string;
    const publish = async (title: string) => {
      const news = await ctx
        .http()
        .post('/api/v1/news')
        .set(auth(board.token))
        .send({ title, categoryId, content: 'Texto da notícia para leitura.' })
        .expect(201);

      await ctx
        .http()
        .post(`/api/v1/news/${news.body.id}/publish`)
        .set(auth(board.token))
        .send({})
        .expect(200);

      return news.body as { id: string; slug: string };
    };
    const read = (slug: string) => ctx.http().post(`/api/v1/public/news/${slug}/view`).expect(204);
    const popular = await publish(`Muito lida ${tag}`);
    const quiet = await publish(`Pouco lida ${tag}`);
    const draft = await ctx
      .http()
      .post('/api/v1/news')
      .set(auth(board.token))
      .send({ title: `Rascunho ${tag}`, categoryId, content: 'Ainda não publicada.' })
      .expect(201);

    await Promise.all([read(popular.slug), read(popular.slug), read(popular.slug)]);
    await read(quiet.slug);
    // Rascunho e endereço inexistente não contam e não revelam nada.
    await read(draft.body.slug as string);
    await read(`nao-existe-${tag}`);

    const rows = await ctx.prisma.newsDailyView.findMany({
      where: { newsId: { in: [popular.id, quiet.id, draft.body.id as string] } }
    });

    expect(rows.find((row) => row.newsId === popular.id)?.views).toBe(3);
    expect(rows.find((row) => row.newsId === quiet.id)?.views).toBe(1);
    expect(rows.some((row) => row.newsId === draft.body.id)).toBe(false);
    // Só notícia, dia e total: nenhuma coluna sobre quem leu.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['day', 'id', 'newsId', 'views']);

    const ranked = (await ctx.http().get('/api/v1/public/news-most-read?limit=10').expect(200))
      .body as { id: string }[];
    const ids = ranked.map((news) => news.id);

    expect(ids.indexOf(popular.id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(popular.id)).toBeLessThan(ids.indexOf(quiet.id));

    // Notícia ocultada sai das mais lidas.
    await ctx
      .http()
      .put(`/api/v1/news/${popular.id}/status`)
      .set(auth(board.token))
      .send({ status: 'HIDDEN', reason: 'Correção' })
      .expect(200);

    const after = (await ctx.http().get('/api/v1/public/news-most-read?limit=10').expect(200))
      .body as { id: string }[];

    expect(after.map((news) => news.id)).not.toContain(popular.id);
  });
});
