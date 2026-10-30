import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/**
 * Fórum mais próximo do público (Onda 4): selo "Diretoria" só para quem tem esse papel (D7,
 * DT-081), última resposta na lista e último tópico ativo na categoria.
 */
describe('Fórum: selo Diretoria e última atividade (D7, DT-081)', () => {
  let ctx: TestContext;
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('marca a diretoria, mostra quem respondeu por último e o último tópico ativo', async () => {
    const board = await tokenFor(ctx, ['board']);
    const fan = await tokenFor(ctx, ['user']);
    const category = await ctx
      .http()
      .post('/api/v1/forum/admin/categories')
      .set(auth(board.token))
      .send({ name: `Torcida ${tag}`, visibility: 'PUBLIC' })
      .expect(201);
    const slug = category.body.slug as string;
    const topic = await ctx
      .http()
      .post(`/api/v1/forum/categories/${slug}/topics`)
      .set(auth(board.token))
      .send({ title: `Horário do ônibus ${tag}`, content: 'Saída às 6h da sede.' })
      .expect(201);
    const fanName = (
      await ctx.prisma.user.findUniqueOrThrow({ where: { id: fan.id }, select: { name: true } })
    ).name;

    await ctx
      .http()
      .post(`/api/v1/forum/topics/${topic.body.id}/posts`)
      .set(auth(fan.token))
      .send({ content: 'Vou levar a bandeira.' })
      .expect(201);

    const detail = await ctx.http().get(`/api/v1/forum/topics/${topic.body.id}`).expect(200);
    const [first, reply] = detail.body.posts.data as {
      author: { id: string; isBoard: boolean };
    }[];

    expect(detail.body.authorIsBoard).toBe(true);
    expect(first?.author).toMatchObject({ id: board.id, isBoard: true });
    expect(reply?.author).toMatchObject({ id: fan.id, isBoard: false });
    expect(detail.body.lastAuthor).toBe(fanName);

    const list = await ctx.http().get(`/api/v1/forum/categories/${slug}/topics`).expect(200);

    expect(list.body.topics.data[0]).toMatchObject({
      id: topic.body.id,
      authorIsBoard: true,
      postCount: 2,
      lastAuthor: fanName
    });

    const categories = await ctx.http().get('/api/v1/forum/categories').expect(200);
    const mine = (
      categories.body as { slug: string; lastTopic: { id: string; title: string } | null }[]
    ).find((row) => row.slug === slug);

    expect(mine?.lastTopic).toMatchObject({ id: topic.body.id });

    // Papel vencido não dá selo.
    await ctx.prisma.userRole.updateMany({
      where: { userId: board.id, role: { code: 'board' } },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    const later = await ctx.http().get(`/api/v1/forum/topics/${topic.body.id}`).expect(200);

    expect(later.body.authorIsBoard).toBe(false);
  });
});
