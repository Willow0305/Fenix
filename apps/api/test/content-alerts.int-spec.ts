import { randomUUID } from 'node:crypto';

import { ContentAlertsService } from '../src/modules/content/application/content-alerts.service';
import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Avisos de notícias, eventos e tópicos do fórum (DT-067)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let fan: { token: string; id: string };
  let quiet: { token: string; id: string };
  let newsCategoryId: string;
  let forumSlug: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const tag = () => randomUUID().slice(0, 6);
  const notificationsOf = (userId: string, type: string) =>
    ctx.prisma.notification.findMany({ where: { userId, type }, include: { deliveries: true } });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    fan = await tokenFor(ctx, ['user']);
    quiet = await tokenFor(ctx, ['user']);
    newsCategoryId = (
      await ctx
        .http()
        .post('/api/v1/news-categories')
        .set(auth(board.token))
        .send({ name: `Avisos ${tag()}` })
        .expect(201)
    ).body.id;
    forumSlug = (
      await ctx
        .http()
        .post('/api/v1/forum/admin/categories')
        .set(auth(board.token))
        .send({ name: `Geral ${tag()}`, visibility: 'PUBLIC' })
        .expect(201)
    ).body.slug;

    // Só "fan" escolhe receber; "quiet" fica no padrão (desligado).
    await ctx
      .http()
      .put('/api/v1/me/notifications/preferences')
      .set(auth(fan.token))
      .send({
        items: ['NEWS', 'EVENTS', 'FORUM_TOPICS'].map((category) => ({
          category,
          channel: 'EMAIL',
          enabled: true
        }))
      })
      .expect(200);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('notícia publicada avisa só quem pediu, uma vez, por e-mail e no painel', async () => {
    const news = await ctx
      .http()
      .post('/api/v1/news')
      .set(auth(board.token))
      .send({ title: `Título ${tag()}`, categoryId: newsCategoryId, content: 'Texto da notícia.' })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/news/${news.body.id}/publish`)
      .set(auth(board.token))
      .send({})
      .expect(200);

    const received = (await notificationsOf(fan.id, 'content.news')).filter(
      (n) => (n.payload as { link?: string }).link === `/noticias/${news.body.slug}`
    );

    expect(received).toHaveLength(1);
    expect(received[0]?.deliveries.map((d) => d.channel)).toEqual(['EMAIL']);
    expect(await notificationsOf(quiet.id, 'content.news')).toHaveLength(0);
  });

  it('notícia agendada é avisada pela rotina quando fica visível, sem repetir', async () => {
    const news = await ctx
      .http()
      .post('/api/v1/news')
      .set(auth(board.token))
      .send({ title: `Agendada ${tag()}`, categoryId: newsCategoryId, content: 'Texto agendado.' })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/news/${news.body.id}/publish`)
      .set(auth(board.token))
      .send({ scheduledAt: new Date(Date.now() + 3_600_000).toISOString() })
      .expect(200);

    const alerts = ctx.app.get(ContentAlertsService);
    const link = (n: { payload: unknown }) =>
      (n.payload as { link?: string }).link === `/noticias/${news.body.slug}`;

    await alerts.announceDue();
    expect((await notificationsOf(fan.id, 'content.news')).filter(link)).toHaveLength(0);

    const later = new Date(Date.now() + 2 * 3_600_000);

    await alerts.announceDue(later);
    await alerts.announceDue(later);
    expect((await notificationsOf(fan.id, 'content.news')).filter(link)).toHaveLength(1);
  });

  it('evento público que entra na agenda avisa; evento interno não', async () => {
    const create = async (isPublic: boolean) =>
      (
        await ctx
          .http()
          .post('/api/v1/events')
          .set(auth(board.token))
          .send({
            title: `Amistoso ${tag()}`,
            type: 'FRIENDLY',
            startsAt: new Date(Date.now() + 3 * 24 * 3_600_000).toISOString(),
            isPublic
          })
          .expect(201)
      ).body as { id: string; slug: string };
    const open = await create(true);
    const internal = await create(false);

    for (const event of [open, internal]) {
      await ctx
        .http()
        .put(`/api/v1/events/${event.id}/status`)
        .set(auth(board.token))
        .send({ status: 'SCHEDULED' })
        .expect(200);
    }

    const links = (await notificationsOf(fan.id, 'content.event')).map(
      (n) => (n.payload as { link?: string }).link
    );

    expect(links).toContain(`/eventos#${open.slug}`);
    expect(links).not.toContain(`/eventos#${internal.slug}`);
  });

  it('tópico novo em categoria pública avisa quem pediu, menos o autor', async () => {
    const topic = await ctx
      .http()
      .post(`/api/v1/forum/categories/${forumSlug}/topics`)
      .set(auth(fan.token))
      .send({ title: `Meu tópico ${tag()}`, content: 'Abrindo a conversa.' })
      .expect(201);
    const other = await ctx
      .http()
      .post(`/api/v1/forum/categories/${forumSlug}/topics`)
      .set(auth(quiet.token))
      .send({ title: `Outro tópico ${tag()}`, content: 'Mais uma conversa.' })
      .expect(201);
    const links = (await notificationsOf(fan.id, 'content.forum_topic')).map(
      (n) => (n.payload as { link?: string }).link
    );

    expect(links).toContain(`/forum/topicos/${other.body.id}`);
    expect(links).not.toContain(`/forum/topicos/${topic.body.id}`);
  });

  it('qualquer pessoa vê as três finalidades nas preferências', async () => {
    const prefs = await ctx
      .http()
      .get('/api/v1/me/notifications/preferences')
      .set(auth(quiet.token))
      .expect(200);
    const categories = (prefs.body.categories as { category: string; email: boolean }[]).filter(
      (c) => ['NEWS', 'EVENTS', 'FORUM_TOPICS'].includes(c.category)
    );

    expect(categories).toHaveLength(3);
    expect(categories.every((c) => !c.email)).toBe(true);
  });
});
