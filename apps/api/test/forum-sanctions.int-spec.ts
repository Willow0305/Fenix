import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Advertências, suspensões e regras do fórum (DT-108). */
describe('Fórum: advertência, suspensão e regras (DT-108)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let slug: string;
  const tag = randomUUID().slice(0, 6);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    slug = (
      await ctx
        .http()
        .post('/api/v1/forum/admin/categories')
        .set(auth(board.token))
        .send({ name: `Regras ${tag}`, visibility: 'PUBLIC' })
        .expect(201)
    ).body.slug as string;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function topicBy(token: string, title: string): Promise<string> {
    return (
      await ctx
        .http()
        .post(`/api/v1/forum/categories/${slug}/topics`)
        .set(auth(token))
        .send({ title, content: 'Mensagem de teste no fórum.' })
        .expect(201)
    ).body.id as string;
  }

  it('advertência avisa no site e por e-mail, sem bloquear', async () => {
    const fan = await tokenFor(ctx, ['user']);
    const topicId = await topicBy(fan.token, `Provocação ${tag}`);

    await ctx
      .http()
      .post('/api/v1/forum/admin/sanctions')
      .set(auth(fan.token))
      .send({
        userId: board.id,
        kind: 'WARNING',
        rule: 'Respeito',
        reason: 'Tentativa sem permissão.'
      })
      .expect(403);

    const warned = await ctx
      .http()
      .post('/api/v1/forum/admin/sanctions')
      .set(auth(board.token))
      .send({
        userId: fan.id,
        kind: 'WARNING',
        rule: 'Respeito',
        reason: 'Provocou a torcida adversária no tópico.',
        topicId
      })
      .expect(201);

    expect(warned.body).toMatchObject({ kind: 'WARNING', active: false, endsAt: null });

    const notice = await ctx.prisma.notification.findFirstOrThrow({
      where: { userId: fan.id, type: 'forum.sanction.warning' },
      include: { deliveries: true }
    });

    expect(notice.message).toContain('Respeito');
    // O e-mail do fórum vem desligado por padrão, mas o aviso de moderação sai mesmo assim.
    expect(notice.deliveries.map((delivery) => delivery.channel)).toContain('EMAIL');

    // Advertido continua participando.
    await ctx
      .http()
      .post(`/api/v1/forum/topics/${topicId}/posts`)
      .set(auth(fan.token))
      .send({ content: 'Desculpem, não vai se repetir.' })
      .expect(201);
  });

  it('suspensão bloqueia publicar, responder, editar e reagir; ler continua', async () => {
    const fan = await tokenFor(ctx, ['user']);
    const topicId = await topicBy(fan.token, `Antes da suspensão ${tag}`);
    const postId = (await ctx.http().get(`/api/v1/forum/topics/${topicId}`).expect(200)).body.posts
      .data[0].id as string;

    const suspended = await ctx
      .http()
      .post('/api/v1/forum/admin/sanctions')
      .set(auth(board.token))
      .send({
        userId: fan.id,
        kind: 'SUSPENSION',
        rule: 'Privacidade',
        reason: 'Publicou o telefone de outra pessoa.',
        days: 7
      })
      .expect(201);

    expect(suspended.body.active).toBe(true);
    expect(new Date(suspended.body.endsAt as string).getTime()).toBeGreaterThan(
      Date.now() + 6 * 86_400_000
    );

    const standing = await ctx
      .http()
      .get('/api/v1/forum/me/standing')
      .set(auth(fan.token))
      .expect(200);

    expect(standing.body.suspension).toMatchObject({ rule: 'Privacidade' });

    const blocked = await ctx
      .http()
      .post(`/api/v1/forum/categories/${slug}/topics`)
      .set(auth(fan.token))
      .send({ title: `Durante ${tag}`, content: 'Não deveria sair.' })
      .expect(403);

    expect(JSON.stringify(blocked.body)).toMatch(/suspenso do fórum até/);
    await ctx
      .http()
      .post(`/api/v1/forum/topics/${topicId}/posts`)
      .set(auth(fan.token))
      .send({ content: 'Também não.' })
      .expect(403);
    await ctx
      .http()
      .patch(`/api/v1/forum/posts/${postId}`)
      .set(auth(fan.token))
      .send({ content: 'Editando escondido.' })
      .expect(403);
    await ctx
      .http()
      .put(`/api/v1/forum/posts/${postId}/reaction`)
      .set(auth(fan.token))
      .send({ type: 'LIKE' })
      .expect(403);
    await ctx.http().get(`/api/v1/forum/topics/${topicId}`).set(auth(fan.token)).expect(200);

    const category = await ctx
      .http()
      .get(`/api/v1/forum/categories/${slug}/topics`)
      .set(auth(fan.token))
      .expect(200);

    expect(category.body.category.canPost).toBe(false);

    // Liberar com motivo: volta a participar e o histórico fica.
    await ctx
      .http()
      .post(`/api/v1/forum/admin/sanctions/${suspended.body.id as string}/lift`)
      .set(auth(board.token))
      .send({ reason: 'Pediu desculpas e apagou a mensagem.' })
      .expect(200);
    await ctx
      .http()
      .post(`/api/v1/forum/topics/${topicId}/posts`)
      .set(auth(fan.token))
      .send({ content: 'Voltei, seguindo as regras.' })
      .expect(201);
    await ctx
      .http()
      .post(`/api/v1/forum/admin/sanctions/${suspended.body.id as string}/lift`)
      .set(auth(board.token))
      .send({ reason: 'De novo.' })
      .expect(409);

    const history = await ctx
      .http()
      .get(`/api/v1/forum/admin/sanctions?userId=${fan.id}`)
      .set(auth(board.token))
      .expect(200);

    expect(history.body.data).toEqual([
      expect.objectContaining({ kind: 'SUSPENSION', active: false, liftReason: expect.any(String) })
    ]);
    await expect(
      ctx.prisma.forumSanction.delete({ where: { id: suspended.body.id as string } })
    ).rejects.toThrow();
  });

  it('suspensão sem prazo vale até liberar; prazo vencido libera sozinho', async () => {
    const fan = await tokenFor(ctx, ['user']);
    const open = await ctx
      .http()
      .post('/api/v1/forum/admin/sanctions')
      .set(auth(board.token))
      .send({
        userId: fan.id,
        kind: 'SUSPENSION',
        rule: 'Respeito',
        reason: 'Ameaçou outro torcedor.'
      })
      .expect(201);

    expect(open.body.endsAt).toBeNull();
    await ctx
      .http()
      .post(`/api/v1/forum/categories/${slug}/topics`)
      .set(auth(fan.token))
      .send({ title: `Sem prazo ${tag}`, content: 'Bloqueado.' })
      .expect(403);

    // O prazo de uma suspensão que já passou não bloqueia mais.
    const other = await tokenFor(ctx, ['user']);

    await ctx.prisma.forumSanction.create({
      data: {
        userId: other.id,
        kind: 'SUSPENSION',
        rule: 'Assunto',
        reason: 'Propaganda repetida no fórum.',
        endsAt: new Date(Date.now() - 1000),
        createdById: board.id
      }
    });
    await topicBy(other.token, `Prazo vencido ${tag}`);
  });

  it('regras: texto inicial, a diretoria edita e as linhas numeradas viram sugestões', async () => {
    const initial = await ctx.http().get('/api/v1/forum/rules').expect(200);

    expect(initial.body.titles).toContain('Respeito');

    const fan = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .put('/api/v1/forum/admin/rules')
      .set(auth(fan.token))
      .send({ text: 'Tentativa.' })
      .expect(403);

    const custom = await ctx
      .http()
      .put('/api/v1/forum/admin/rules')
      .set(auth(board.token))
      .send({ text: 'Regras do Fênix:\n1. Educação: trate todos bem.\n2. Foco: fale de vôlei.' })
      .expect(200);

    expect(custom.body).toMatchObject({ custom: true, titles: ['Educação', 'Foco'] });

    const reset = await ctx
      .http()
      .put('/api/v1/forum/admin/rules')
      .set(auth(board.token))
      .send({ text: '' })
      .expect(200);

    expect(reset.body.custom).toBe(false);
  });
});
