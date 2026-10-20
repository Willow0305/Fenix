import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Fase 7 — comunicação', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let newsCategoryId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const tag = () => randomUUID().slice(0, 6);

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    newsCategoryId = (
      await ctx
        .http()
        .post('/api/v1/news-categories')
        .set(auth(board.token))
        .send({ name: `Comunicados ${tag()}` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function draftNews(extra: Record<string, unknown> = {}) {
    const created = await ctx
      .http()
      .post('/api/v1/news')
      .set(auth(board.token))
      .send({
        title: `Vitória no estadual ${tag()}`,
        categoryId: newsCategoryId,
        content: 'O time venceu por 3 sets a 1. <script>alert(1)</script>Parabéns!',
        showOnHome: true,
        ...extra
      })
      .expect(201);

    return created.body as { id: string; slug: string; content: string; status: string };
  }

  it('publishes news immediately or on schedule, in every channel, and hides it everywhere', async () => {
    const news = await draftNews({ showOnForum: true });

    expect(news.status).toBe('DRAFT');
    expect(news.content).not.toContain('<script>');
    await ctx.http().get(`/api/v1/public/news/${news.slug}`).expect(404);

    const future = new Date(Date.now() + 2 * 3_600_000).toISOString();
    const scheduled = await ctx
      .http()
      .post(`/api/v1/news/${news.id}/publish`)
      .set(auth(board.token))
      .send({ scheduledAt: future })
      .expect(200);

    expect(scheduled.body.status).toBe('SCHEDULED');
    await ctx.http().get(`/api/v1/public/news/${news.slug}`).expect(404);

    const homeBefore = await ctx
      .http()
      .get('/api/v1/public/news?channel=home&pageSize=100')
      .expect(200);

    expect(homeBefore.body.data.map((n: { id: string }) => n.id)).not.toContain(news.id);

    // O instante agendado chega: passa a aparecer sem nenhuma ação (UTC).
    await ctx.prisma.news.update({
      where: { id: news.id },
      data: { publishedAt: new Date(Date.now() - 1000) }
    });

    await ctx.http().get(`/api/v1/public/news/${news.slug}`).expect(200);

    for (const channel of ['home', 'forum']) {
      const list = await ctx
        .http()
        .get(`/api/v1/public/news?channel=${channel}&pageSize=100`)
        .expect(200);

      expect(list.body.data.map((n: { id: string }) => n.id)).toContain(news.id);
    }

    const locked = await ctx
      .http()
      .patch(`/api/v1/news/${news.id}`)
      .set(auth(board.token))
      .send({ slug: 'outro-endereco' })
      .expect(409);

    expect(locked.body.code).toBe('SLUG_LOCKED');

    await ctx
      .http()
      .put(`/api/v1/news/${news.id}/status`)
      .set(auth(board.token))
      .send({ status: 'HIDDEN' })
      .expect(422);
    await ctx
      .http()
      .put(`/api/v1/news/${news.id}/status`)
      .set(auth(board.token))
      .send({ status: 'HIDDEN', reason: 'Informação incorreta' })
      .expect(200);
    await ctx.http().get(`/api/v1/public/news/${news.slug}`).expect(404);

    const forum = await ctx
      .http()
      .get('/api/v1/public/news?channel=forum&pageSize=100')
      .expect(200);

    expect(forum.body.data.map((n: { id: string }) => n.id)).not.toContain(news.id);

    const user = await tokenFor(ctx, ['user']);

    await ctx.http().post('/api/v1/news').set(auth(user.token)).send({}).expect(403);
  });

  it('publishes public events and matches with linked news only when visible', async () => {
    const event = await ctx
      .http()
      .post('/api/v1/events')
      .set(auth(board.token))
      .send({
        title: `Fênix x Águias ${tag()}`,
        type: 'MATCH',
        startsAt: new Date(Date.now() + 5 * 24 * 3_600_000).toISOString(),
        locationName: 'Ginásio Central',
        isPublic: true,
        match: { opponentName: 'Águias', competitionName: 'Estadual', isHome: true }
      })
      .expect(201);
    const publicIds = async () =>
      ((await ctx.http().get('/api/v1/public/events').expect(200)).body as { id: string }[]).map(
        (e) => e.id
      );

    expect(event.body.match.opponentName).toBe('Águias');
    expect(await publicIds()).not.toContain(event.body.id);

    await ctx
      .http()
      .put(`/api/v1/events/${event.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'SCHEDULED' })
      .expect(200);

    expect(await publicIds()).toContain(event.body.id);

    const news = await draftNews({ eventId: event.body.id });
    let detail = await ctx.http().get(`/api/v1/public/events/${event.body.slug}`).expect(200);

    expect(detail.body.news).toHaveLength(0);

    await ctx
      .http()
      .post(`/api/v1/news/${news.id}/publish`)
      .set(auth(board.token))
      .send({})
      .expect(200);
    detail = await ctx.http().get(`/api/v1/public/events/${event.body.slug}`).expect(200);

    expect(detail.body.news.map((n: { id: string }) => n.id)).toEqual([news.id]);

    const result = await ctx
      .http()
      .patch(`/api/v1/events/${event.body.id}`)
      .set(auth(board.token))
      .send({ match: { opponentName: 'Águias', teamScore: 3, opponentScore: 1 } })
      .expect(200);

    expect(result.body.match.teamScore).toBe(3);

    await ctx
      .http()
      .put(`/api/v1/events/${event.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'CANCELLED' })
      .expect(422);

    const internal = await ctx
      .http()
      .post('/api/v1/events')
      .set(auth(board.token))
      .send({
        title: `Treino fechado ${tag()}`,
        type: 'TRAINING',
        startsAt: new Date(Date.now() + 24 * 3_600_000).toISOString()
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/events/${internal.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'SCHEDULED' })
      .expect(200);

    expect(await publicIds()).not.toContain(internal.body.id);
    await ctx.http().get(`/api/v1/public/events/${internal.body.slug}`).expect(404);
  });

  describe('forum', () => {
    let publicSlug: string;
    let membersSlug: string;
    let staffSlug: string;
    let member: { token: string; id: string };
    let alice: { token: string; id: string };
    let bob: { token: string; id: string };

    beforeAll(async () => {
      const make = async (visibility: string) =>
        (
          await ctx
            .http()
            .post('/api/v1/forum/admin/categories')
            .set(auth(board.token))
            .send({ name: `Fórum ${visibility} ${tag()}`, visibility })
            .expect(201)
        ).body.slug as string;

      publicSlug = await make('PUBLIC');
      membersSlug = await make('MEMBERS');
      staffSlug = await make('STAFF');
      member = await tokenFor(ctx, ['athlete']);
      alice = await tokenFor(ctx, ['user']);
      bob = await tokenFor(ctx, ['user']);
    });

    it('never leaks restricted categories or topics', async () => {
      await ctx
        .http()
        .post(`/api/v1/forum/categories/${membersSlug}/topics`)
        .set(auth(member.token))
        .send({ title: 'Escala da viagem', content: 'Saída às 6h.' })
        .expect(201);

      const slugsFor = async (token?: string) => {
        const request = ctx.http().get('/api/v1/forum/categories');
        const response = await (token ? request.set(auth(token)) : request).expect(200);

        return (response.body as { slug: string }[]).map((c) => c.slug);
      };

      expect(await slugsFor()).toContain(publicSlug);
      expect(await slugsFor()).not.toContain(membersSlug);
      expect(await slugsFor(alice.token)).not.toContain(membersSlug);
      expect(await slugsFor(member.token)).toContain(membersSlug);
      expect(await slugsFor(member.token)).not.toContain(staffSlug);
      expect(await slugsFor(board.token)).toEqual(
        expect.arrayContaining([publicSlug, membersSlug, staffSlug])
      );

      await ctx.http().get(`/api/v1/forum/categories/${membersSlug}/topics`).expect(404);
      await ctx
        .http()
        .get(`/api/v1/forum/categories/${membersSlug}/topics`)
        .set(auth(alice.token))
        .expect(404);

      const topics = await ctx
        .http()
        .get(`/api/v1/forum/categories/${membersSlug}/topics`)
        .set(auth(member.token))
        .expect(200);
      const topicId = topics.body.topics.data[0].id as string;

      await ctx.http().get(`/api/v1/forum/topics/${topicId}`).set(auth(alice.token)).expect(404);
      await ctx
        .http()
        .post(`/api/v1/forum/topics/${topicId}/posts`)
        .set(auth(alice.token))
        .send({ content: 'Posso ir?' })
        .expect(404);
      await ctx
        .http()
        .post(`/api/v1/forum/categories/${staffSlug}/topics`)
        .set(auth(member.token))
        .send({ title: 'Teste', content: 'Teste' })
        .expect(404);
    });

    it('lets verified users participate with idempotent reactions and reports, under moderation', async () => {
      await ctx
        .http()
        .post(`/api/v1/forum/categories/${publicSlug}/topics`)
        .send({ title: 'Anônimo', content: 'Oi' })
        .expect(401);

      const topic = await ctx
        .http()
        .post(`/api/v1/forum/categories/${publicSlug}/topics`)
        .set(auth(alice.token))
        .send({ title: 'Dicas de aquecimento', content: 'Quais exercícios vocês fazem?' })
        .expect(201);
      const topicId = topic.body.id as string;
      const reply = await ctx
        .http()
        .post(`/api/v1/forum/topics/${topicId}/posts`)
        .set(auth(bob.token))
        .send({ content: 'Polichinelo e <b>alongamento</b>.' })
        .expect(201);
      const postId = reply.body.id as string;

      expect(reply.body.content).toBe('Polichinelo e alongamento.');
      expect(
        await ctx.prisma.notification.count({ where: { userId: alice.id, type: 'forum.reply' } })
      ).toBe(1);

      for (let i = 0; i < 2; i += 1) {
        const reacted = await ctx
          .http()
          .put(`/api/v1/forum/posts/${postId}/reaction`)
          .set(auth(alice.token))
          .send({ type: 'LIKE' })
          .expect(200);

        expect(reacted.body.reactions.LIKE).toBe(1);
        expect(reacted.body.myReaction).toBe('LIKE');
      }

      await ctx
        .http()
        .patch(`/api/v1/forum/posts/${postId}`)
        .set(auth(alice.token))
        .send({ content: 'Editado por outra pessoa' })
        .expect(403);
      await ctx
        .http()
        .patch(`/api/v1/forum/posts/${postId}`)
        .set(auth(bob.token))
        .send({ content: 'Polichinelo e alongamento dinâmico.' })
        .expect(200);

      const first = await ctx
        .http()
        .post('/api/v1/forum/reports')
        .set(auth(alice.token))
        .send({ postId, reason: 'Conteúdo fora do tema' })
        .expect(201);
      const second = await ctx
        .http()
        .post('/api/v1/forum/reports')
        .set(auth(alice.token))
        .send({ postId, reason: 'De novo' })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      await ctx.http().get('/api/v1/forum/reports').set(auth(alice.token)).expect(403);

      await ctx
        .http()
        .post(`/api/v1/forum/posts/${postId}/moderation`)
        .set(auth(board.token))
        .send({ action: 'HIDE', reason: 'Fora do tema' })
        .expect(204);

      const asUser = await ctx.http().get(`/api/v1/forum/topics/${topicId}`).set(auth(alice.token));
      const asStaff = await ctx
        .http()
        .get(`/api/v1/forum/topics/${topicId}`)
        .set(auth(board.token));

      expect(asUser.body.posts.data.map((p: { id: string }) => p.id)).not.toContain(postId);
      expect(
        asStaff.body.posts.data.find((p: { id: string }) => p.id === postId).content
      ).toContain('dinâmico');

      await ctx
        .http()
        .put(`/api/v1/forum/reports/${first.body.id}`)
        .set(auth(board.token))
        .send({ status: 'RESOLVED', resolution: 'Mensagem ocultada.' })
        .expect(204);
      await ctx
        .http()
        .post(`/api/v1/forum/topics/${topicId}/moderation`)
        .set(auth(board.token))
        .send({ action: 'CLOSE', reason: 'Assunto encerrado' })
        .expect(204);

      const closed = await ctx
        .http()
        .post(`/api/v1/forum/topics/${topicId}/posts`)
        .set(auth(bob.token))
        .send({ content: 'Mais uma' })
        .expect(409);

      expect(closed.body.code).toBe('TOPIC_CLOSED');

      const history = await ctx
        .http()
        .get(`/api/v1/forum/moderation-actions?topicId=${topicId}`)
        .set(auth(board.token))
        .expect(200);

      expect(history.body.data.map((a: { action: string }) => a.action)).toEqual(
        expect.arrayContaining(['HIDE', 'CLOSE'])
      );
      expect(
        await ctx.prisma.notification.count({ where: { userId: bob.id, type: 'forum.moderation' } })
      ).toBe(1);
    });

    it('limits posting bursts', async () => {
      const spammer = await tokenFor(ctx, ['user']);
      const topic = await ctx
        .http()
        .post(`/api/v1/forum/categories/${publicSlug}/topics`)
        .set(auth(spammer.token))
        .send({ title: 'Rajada', content: 'Primeira' })
        .expect(201);
      let status = 0;

      for (let i = 0; i < 8 && status !== 429; i += 1) {
        status = (
          await ctx
            .http()
            .post(`/api/v1/forum/topics/${topic.body.id}/posts`)
            .set(auth(spammer.token))
            .send({ content: `Mensagem ${i}` })
        ).status;
      }

      expect(status).toBe(429);
    });
  });

  it('broadcasts announcements once per idempotency key', async () => {
    const key = { 'Idempotency-Key': `test-${randomUUID()}` };
    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .post('/api/v1/notifications/broadcast')
      .set(auth(user.token))
      .set(key)
      .send({ audience: 'STAFF', title: 'Reunião', message: 'Sexta às 19h.' })
      .expect(403);

    const sent = await ctx
      .http()
      .post('/api/v1/notifications/broadcast')
      .set(auth(board.token))
      .set(key)
      .send({ audience: 'STAFF', title: 'Reunião', message: 'Sexta às 19h.', link: '/admin' })
      .expect(201);

    expect(sent.body.replayed).toBe(false);
    expect(sent.body.delivered).toBeGreaterThan(0);

    const replay = await ctx
      .http()
      .post('/api/v1/notifications/broadcast')
      .set(auth(board.token))
      .set(key)
      .send({ audience: 'STAFF', title: 'Reunião', message: 'Sexta às 19h.' })
      .expect(201);

    expect(replay.body.replayed).toBe(true);
    expect(replay.body.delivered).toBe(0);

    const external = await ctx
      .http()
      .post('/api/v1/notifications/broadcast')
      .set(auth(board.token))
      .set({ 'Idempotency-Key': `test-${randomUUID()}` })
      .send({ audience: 'STAFF', title: 'Link', message: 'Externo', link: 'https://evil.test' })
      .expect(422);

    expect(external.body.code).toBe('INVALID_LINK');
  });
});
