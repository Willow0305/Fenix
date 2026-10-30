import { randomUUID } from 'node:crypto';

import { createTestContext, PNG_1X1, type TestContext, tokenFor } from './helpers';

/** Galeria de fotos da notícia (D8, DT-081): envio, legenda, ordem e remoção lógica. */
describe('Galeria da notícia (D8, DT-081)', () => {
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

  it('envia, legenda, reordena e remove; o site mostra a galeria na ordem', async () => {
    const categoryId = (
      await ctx
        .http()
        .post('/api/v1/news-categories')
        .set(auth(board.token))
        .send({ name: `Galeria ${tag}` })
        .expect(201)
    ).body.id as string;
    const news = await ctx
      .http()
      .post('/api/v1/news')
      .set(auth(board.token))
      .send({ title: `Fotos do jogo ${tag}`, categoryId, content: 'Cobertura do jogo de sábado.' })
      .expect(201);
    const path = `/api/v1/news/${news.body.id}/gallery`;
    const upload = (name: string) =>
      ctx
        .http()
        .post(path)
        .set(auth(board.token))
        .field('altText', `Lance ${name}`)
        .attach('file', PNG_1X1, { filename: `${name}.png`, contentType: 'image/png' })
        .expect(201);
    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .post(path)
      .set(auth(user.token))
      .attach('file', PNG_1X1, { filename: 'x.png', contentType: 'image/png' })
      .expect(403);

    await upload('a');

    const two = await upload('b');
    const [first, second] = two.body.gallery as { id: string; altText: string }[];

    expect(two.body.gallery).toHaveLength(2);
    expect(first?.altText).toBe('Lance a');

    await ctx
      .http()
      .put(`${path}/order`)
      .set(auth(board.token))
      .send({ imageIds: [first?.id] })
      .expect(409);

    const reordered = await ctx
      .http()
      .put(`${path}/order`)
      .set(auth(board.token))
      .send({ imageIds: [second?.id, first?.id] })
      .expect(200);

    expect(reordered.body.gallery.map((i: { id: string }) => i.id)).toEqual([
      second?.id,
      first?.id
    ]);

    const described = await ctx
      .http()
      .patch(`${path}/${second?.id}`)
      .set(auth(board.token))
      .send({ altText: 'Bloqueio triplo no tie-break' })
      .expect(200);

    expect(described.body.gallery[0].altText).toBe('Bloqueio triplo no tie-break');

    await ctx.http().delete(`${path}/${first?.id}`).set(auth(board.token)).expect(200);
    await ctx
      .http()
      .post(`/api/v1/news/${news.body.id}/publish`)
      .set(auth(board.token))
      .send({})
      .expect(200);

    const shown = await ctx.http().get(`/api/v1/public/news/${news.body.slug}`).expect(200);

    expect(shown.body.gallery).toEqual([
      expect.objectContaining({ id: second?.id, altText: 'Bloqueio triplo no tie-break' })
    ]);
    // Remoção lógica: o registro fica para a auditoria.
    expect(
      await ctx.prisma.newsImage.count({ where: { id: first?.id ?? '', deletedAt: { not: null } } })
    ).toBe(1);
  });
});
