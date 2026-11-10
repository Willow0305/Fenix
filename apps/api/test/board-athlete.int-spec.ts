import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

/** Atleta que também é da diretoria paga mensalidade; cargo na diretoria (DT-102). */
describe('Atleta na diretoria e cargo (DT-102)', () => {
  let ctx: TestContext;
  let admin: { token: string; id: string };
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const reason = 'Eleição da diretoria';

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await tokenFor(ctx, ['admin']);
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('quem é atleta e diretoria recebe a mensalidade do plano normalmente', async () => {
    const director = await tokenFor(ctx, ['board', 'athlete']);
    const athlete = await ctx.prisma.athlete.create({
      data: { fullName: 'Diretora Atleta Souza', status: 'ACTIVE', userId: director.id }
    });
    const plan = await ctx
      .http()
      .post('/api/v1/fee-plans')
      .set(auth(board.token))
      .send({ name: `Plano ${randomUUID().slice(0, 4)}`, amount: '80.00', dueDay: 10 })
      .expect(201);

    await ctx
      .http()
      .post(`/api/v1/athletes/${athlete.id}/fee-plans`)
      .set(auth(board.token))
      .send({ planId: plan.body.id, startsOn: '2020-01-01' })
      .expect(201);

    const year = 2030 + Math.floor(Math.random() * 60);
    const month = `${year}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}`;

    await ctx
      .http()
      .post('/api/v1/monthly-fees/generate')
      .set(auth(board.token))
      .send({ referenceMonth: month })
      .expect(200);

    const fee = await ctx.prisma.monthlyFee.findFirstOrThrow({ where: { athleteId: athlete.id } });

    expect(fee.totalAmount.toFixed(2)).toBe('80.00');
    expect(fee.status).toBe('OPEN');
  });

  it('cargo só para quem tem o papel Diretoria, com auditoria; sai junto com o papel', async () => {
    const person = await tokenFor(ctx, ['user']);
    const put = (userId: string, body: Record<string, unknown>, token = admin.token) =>
      ctx.http().put(`/api/v1/users/${userId}/board-position`).set(auth(token)).send(body);

    const refused = await put(person.id, { boardPosition: 'Tesoureira', reason }).expect(422);

    expect(refused.body.code).toBe('NOT_BOARD');
    // Diretoria não atribui papéis nem cargos (governança é do administrador).
    await put(board.id, { boardPosition: 'Presidente', reason }, board.token).expect(403);

    await ctx
      .http()
      .put(`/api/v1/users/${person.id}/roles`)
      .set(auth(admin.token))
      .send({ roles: ['user', 'board'], reason })
      .expect(200);

    const saved = await put(person.id, { boardPosition: '  Tesoureira  ', reason }).expect(200);

    expect(saved.body.boardPosition).toBe('Tesoureira');
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: person.id, action: 'user.board_position.changed' }
      })
    ).toBe(1);

    // Aparece na carteirinha gratuita da diretoria.
    const cards = await ctx.http().get('/api/v1/me/cards').set(auth(person.token)).expect(200);
    const boardCard = (cards.body.cards as { type: string; boardPosition: string | null }[]).find(
      (card) => card.type === 'BOARD'
    );

    expect(boardCard?.boardPosition).toBe('Tesoureira');

    await ctx
      .http()
      .put(`/api/v1/users/${person.id}/roles`)
      .set(auth(admin.token))
      .send({ roles: ['user'], reason: 'Saiu da diretoria' })
      .expect(200);

    const after = await ctx.http().get(`/api/v1/users/${person.id}`).set(auth(admin.token));

    expect(after.body.boardPosition).toBeNull();
  });
});
