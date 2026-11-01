import { createTestContext, PASSWORD, type TestContext, tokenFor, uniqueEmail } from './helpers';

/** Versões dos termos e da política e aceite por versão no cadastro (DT-089). */
describe('versões dos termos de uso e da política de privacidade', () => {
  let ctx: TestContext;
  let admin: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await tokenFor(ctx, ['admin']);
  });

  afterAll(async () => {
    // Textos fora do ar: as outras suítes cadastram contas sem versão a aceitar.
    await ctx
      .http()
      .patch('/api/v1/team-settings')
      .set(auth(admin.token))
      .send({ termsOfUse: null, privacyPolicy: null })
      .expect(200);
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function publish(patch: Record<string, string | null>) {
    await ctx.http().patch('/api/v1/team-settings').set(auth(admin.token)).send(patch).expect(200);

    return (await ctx.http().get('/api/v1/public/team').expect(200)).body.legalVersions as {
      termsOfUse: { id: string; version: number; publishedAt: string } | null;
      privacyPolicy: { id: string; version: number; publishedAt: string } | null;
    };
  }

  function register(extra: Record<string, unknown>) {
    return ctx
      .http()
      .post('/api/v1/auth/register')
      .send({
        name: 'Carla Teste',
        email: uniqueEmail('termos'),
        password: PASSWORD,
        acceptTerms: true,
        minimumAgeConfirmed: true,
        ...extra
      });
  }

  it('cria uma versão a cada texto alterado e nenhuma quando o texto não muda', async () => {
    const first = await publish({
      termsOfUse: `Termos ${Date.now()}`,
      privacyPolicy: `Política ${Date.now()}`
    });

    expect(first.termsOfUse).toEqual({
      id: expect.any(String),
      version: expect.any(Number),
      publishedAt: expect.any(String)
    });

    const same = await publish({ phone: '(68) 99999-0001' });

    expect(same.termsOfUse?.id).toBe(first.termsOfUse?.id);

    const changed = await publish({ termsOfUse: `Termos novos ${Date.now()}` });

    expect(changed.termsOfUse?.version).toBe((first.termsOfUse?.version ?? 0) + 1);
    expect(changed.privacyPolicy?.id).toBe(first.privacyPolicy?.id);

    const row = await ctx.prisma.legalDocumentVersion.findUniqueOrThrow({
      where: { id: changed.termsOfUse?.id ?? '' }
    });

    expect(row.content).toMatch(/^Termos novos/);
    expect(row.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.publishedByUserId).toBe(admin.id);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: row.id, action: 'legal.version.published' }
      })
    ).toBe(1);
  });

  it('guarda no cadastro as versões que a pessoa aceitou', async () => {
    const current = await publish({
      termsOfUse: `Termos do cadastro ${Date.now()}`,
      privacyPolicy: `Política do cadastro ${Date.now()}`
    });
    const response = await register({
      termsVersionId: current.termsOfUse?.id,
      privacyVersionId: current.privacyPolicy?.id
    }).expect(201);
    const me = await ctx.http().get('/api/v1/me').set(auth(response.body.accessToken)).expect(200);
    const accepted = await ctx.prisma.legalAcceptance.findMany({
      where: { userId: me.body.id },
      select: { documentVersionId: true, context: true }
    });

    expect(accepted).toEqual(
      expect.arrayContaining([
        { documentVersionId: current.termsOfUse?.id, context: 'SIGNUP' },
        { documentVersionId: current.privacyPolicy?.id, context: 'SIGNUP' }
      ])
    );
    expect(accepted).toHaveLength(2);
  });

  it('pede nova leitura quando a versão aceita não é a que está em vigor', async () => {
    const old = await publish({ termsOfUse: `Termos antigos ${Date.now()}` });
    const current = await publish({ termsOfUse: `Termos atuais ${Date.now()}` });
    const outdated = await register({
      termsVersionId: old.termsOfUse?.id,
      privacyVersionId: current.privacyPolicy?.id
    }).expect(409);

    expect(outdated.body.code).toBe('LEGAL_VERSION_CHANGED');

    const missing = await register({}).expect(409);

    expect(missing.body.code).toBe('LEGAL_VERSION_CHANGED');
  });

  it('quem já tem conta aceita de novo quando a versão muda (DT-094)', async () => {
    const first = await publish({
      termsOfUse: `Termos A ${Date.now()}`,
      privacyPolicy: `Política A ${Date.now()}`
    });
    const signup = await register({
      termsVersionId: first.termsOfUse?.id,
      privacyVersionId: first.privacyPolicy?.id
    }).expect(201);
    const token = signup.body.accessToken as string;
    const me = async () =>
      (await ctx.http().get('/api/v1/me').set(auth(token)).expect(200)).body as {
        pendingLegal: { field: string; id: string; version: number }[];
      };

    expect((await me()).pendingLegal).toEqual([]);

    const second = await publish({ termsOfUse: `Termos B ${Date.now()}` });
    const pending = (await me()).pendingLegal;

    expect(pending).toEqual([
      expect.objectContaining({ field: 'termsOfUse', id: second.termsOfUse?.id })
    ]);

    await ctx
      .http()
      .post('/api/v1/me/legal-acceptances')
      .set(auth(token))
      .send({ termsVersionId: first.termsOfUse?.id, privacyVersionId: first.privacyPolicy?.id })
      .expect(409);

    const accepted = await ctx
      .http()
      .post('/api/v1/me/legal-acceptances')
      .set(auth(token))
      .send({ termsVersionId: second.termsOfUse?.id, privacyVersionId: second.privacyPolicy?.id })
      .expect(201);

    expect(accepted.body.pendingLegal).toEqual([]);
    expect(
      await ctx.prisma.legalAcceptance.count({
        where: { documentVersionId: second.termsOfUse?.id ?? '', context: 'UPDATE' }
      })
    ).toBe(1);

    // Conta antiga, sem aceite registrado, também precisa aceitar.
    const legacy = await tokenFor(ctx, ['user']);
    const legacyMe = await ctx.http().get('/api/v1/me').set(auth(legacy.token)).expect(200);

    expect(legacyMe.body.pendingLegal.map((row: { field: string }) => row.field).sort()).toEqual([
      'privacyPolicy',
      'termsOfUse'
    ]);
  });

  it('com o texto fora do ar, cadastra sem versão a aceitar', async () => {
    const none = await publish({ termsOfUse: null, privacyPolicy: null });

    expect(none).toEqual({ termsOfUse: null, privacyPolicy: null });
    await register({}).expect(201);
  });
});
