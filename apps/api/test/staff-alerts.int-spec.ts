import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Pendências do menu e avisos à diretoria (DT-061)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const badges = async (token = board.token) =>
    (await ctx.http().get('/api/v1/dashboard/badges').set(auth(token)).expect(200)).body as Record<
      string,
      number
    >;

  it('interessado novo conta na bolinha e avisa a diretoria', async () => {
    const before = (await badges())['/admin/interessados'] ?? 0;

    await ctx
      .http()
      .post('/api/v1/public/interest')
      .send({
        fullName: `Pessoa Interessada ${randomUUID().slice(0, 4)}`,
        birthDate: '2000-05-10',
        email: `interesse-${randomUUID().slice(0, 6)}@exemplo.test`,
        phone: '68999990000',
        privacyConsent: true
      })
      .expect(201);

    const after = (await badges())['/admin/interessados'] ?? 0;

    expect(after).toBe(before + 1);

    const alerts = await ctx.prisma.notification.findMany({
      where: { userId: board.id, type: 'staff.interest.created' }
    });

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]?.title).toBe('Novo interessado');
  });

  it('sem pendência, o item não aparece; sem painel, não há acesso', async () => {
    const counts = await badges();

    expect(Object.values(counts).every((count) => count > 0)).toBe(true);

    const member = await tokenFor(ctx, ['user']);

    await ctx.http().get('/api/v1/dashboard/badges').set(auth(member.token)).expect(403);
  });

  it('a finalidade "Tarefas da diretoria" só aparece para quem acessa o painel', async () => {
    const member = await tokenFor(ctx, ['user']);
    const staffPrefs = await ctx
      .http()
      .get('/api/v1/me/notifications/preferences')
      .set(auth(board.token))
      .expect(200);
    const memberPrefs = await ctx
      .http()
      .get('/api/v1/me/notifications/preferences')
      .set(auth(member.token))
      .expect(200);
    const operations = (body: { categories: { category: string; email: boolean }[] }) =>
      body.categories.find((item) => item.category === 'OPERATIONS');

    expect(operations(staffPrefs.body)).toMatchObject({ email: false });
    expect(operations(memberPrefs.body)).toBeUndefined();
  });
});
