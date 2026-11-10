import { createTestContext, type TestContext, tokenFor, uniqueEmail } from './helpers';

/** Elenco lotado (DT-107): a diretoria fecha os contatos de "Quero jogar no Fênix". */
describe('Contatos de "Quero jogar no Fênix" (DT-107)', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const interest = () => ({
    fullName: 'Pessoa Interessada',
    email: uniqueEmail('lotado'),
    phone: '68 99999-1111',
    privacyConsent: true,
    birthDate: '1995-05-10'
  });

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    // Deixa aberto para os outros testes que enviam contato.
    await ctx.prisma.teamSettings.updateMany({ data: { interestIntakeOpen: true } });
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('diretoria fecha e reabre; fechado, o site avisa e o servidor recusa', async () => {
    const board = await tokenFor(ctx, ['board']);
    const user = await tokenFor(ctx, ['user']);

    await ctx
      .http()
      .put('/api/v1/interested-people/intake')
      .set(auth(user.token))
      .send({ open: false })
      .expect(403);

    const closed = await ctx
      .http()
      .put('/api/v1/interested-people/intake')
      .set(auth(board.token))
      .send({ open: false, reason: 'Elenco completo para a temporada.' })
      .expect(200);

    expect(closed.body).toEqual({ open: false });
    expect((await ctx.http().get('/api/v1/public/team').expect(200)).body.interestIntakeOpen).toBe(
      false
    );

    const refused = await ctx.http().post('/api/v1/public/interest').send(interest()).expect(409);

    expect(refused.body.code).toBe('INTEREST_CLOSED');
    expect(
      await ctx.prisma.auditLog.count({
        where: { action: 'interested.intake.closed', actorUserId: board.id }
      })
    ).toBe(1);

    await ctx
      .http()
      .put('/api/v1/interested-people/intake')
      .set(auth(board.token))
      .send({ open: true })
      .expect(200);
    await ctx.http().post('/api/v1/public/interest').send(interest()).expect(201);
    expect(
      (await ctx.http().get('/api/v1/interested-people/intake').set(auth(board.token)).expect(200))
        .body
    ).toEqual({ open: true });
  });
});
