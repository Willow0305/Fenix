import { hashPassword } from '../src/common/crypto/password-hasher';
import {
  createTestContext,
  login,
  PASSWORD,
  type TestContext,
  tokenFor,
  uniqueEmail
} from './helpers';

/** Conta do atleta menor criada pela diretoria com a declaração do responsável (DT-092). */
describe('conta de atleta menor de idade', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let teamId: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const minorBirth = `${new Date().getUTCFullYear() - 15}-03-10`;
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    teamId = (
      await ctx
        .http()
        .post('/api/v1/teams')
        .set(auth(board.token))
        .send({ name: `Sub-18 ${Date.now()}`, type: 'FEMALE' })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function athlete(birthDate: string, inTeam = true): Promise<string> {
    const created = await ctx
      .http()
      .post('/api/v1/athletes')
      .set(auth(board.token))
      .send({
        fullName: `Atleta ${Date.now()}`,
        birthDate,
        guardianName: 'Rita Responsável',
        guardianPhone: '(68) 99999-1234',
        guardianAcknowledged: true
      })
      .expect(201);
    const id = created.body.id as string;

    await ctx
      .http()
      .put(`/api/v1/athletes/${id}/status`)
      .set(auth(board.token))
      .send({ status: 'ACTIVE', reason: 'Aprovada na seletiva' });

    if (inTeam) {
      await ctx
        .http()
        .post(`/api/v1/athletes/${id}/memberships`)
        .set(auth(board.token))
        .send({ teamId, startsOn: '2026-01-10' })
        .expect(201);
    }

    return id;
  }

  function createAccount(id: string, email: string, file = true) {
    const request = ctx
      .http()
      .post(`/api/v1/athletes/${id}/minor-account`)
      .set(auth(board.token))
      .field('email', email);

    return file
      ? request.attach('file', PDF, { filename: 'declaracao.pdf', contentType: 'application/pdf' })
      : request;
  }

  it('cria a conta com a declaração, perfil privado e papel de atleta', async () => {
    const id = await athlete(minorBirth);
    const email = uniqueEmail('menor');
    const created = await createAccount(id, email).expect(201);

    expect(created.body.user).toMatchObject({ email, profilePublic: false });
    expect(created.body.guardianDeclaration).toEqual({
      id: expect.any(String),
      uploadedAt: expect.any(String)
    });

    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
      select: { userRoles: { select: { role: { select: { code: true } } } } }
    });

    expect(user.userRoles.map((row) => row.role.code).sort()).toEqual(['athlete', 'user']);
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: id, action: 'athlete.minor_account.created' }
      })
    ).toBe(1);

    const file = await ctx
      .http()
      .get(`/api/v1/athletes/${id}/guardian-declaration`)
      .set(auth(board.token))
      .expect(200);

    expect(file.headers['content-type']).toContain('application/pdf');
    expect(
      await ctx.prisma.auditLog.count({
        where: { entityId: id, action: 'athlete.guardian_declaration.read' }
      })
    ).toBe(1);
  });

  it('recusa sem declaração, sem equipe, adulto ou atleta que já tem conta', async () => {
    const minor = await athlete(minorBirth);

    expect((await createAccount(minor, uniqueEmail(), false).expect(422)).body.code).toBe(
      'FILE_REQUIRED'
    );
    expect(
      (await createAccount(await athlete(minorBirth, false), uniqueEmail()).expect(422)).body.code
    ).toBe('ATHLETE_NOT_IN_TEAM');
    expect(
      (await createAccount(await athlete('2000-01-01'), uniqueEmail()).expect(422)).body.code
    ).toBe('ATHLETE_ADULT');

    await createAccount(minor, uniqueEmail()).expect(201);
    expect((await createAccount(minor, uniqueEmail()).expect(409)).body.code).toBe(
      'ATHLETE_HAS_ACCOUNT'
    );
  });

  it('a conta do menor não participa do fórum nem deixa o perfil público', async () => {
    const id = await athlete(minorBirth);
    const email = uniqueEmail('menor-forum');

    await createAccount(id, email).expect(201);
    // A pessoa define a senha pelo link do e-mail; no teste, direto no banco.
    await ctx.prisma.user.update({
      where: { email },
      data: { passwordHash: await hashPassword(PASSWORD) }
    });

    const token = await login(ctx, email);
    const slug = (
      await ctx
        .http()
        .post('/api/v1/forum/admin/categories')
        .set(auth(board.token))
        .send({ name: `Geral ${Date.now()}`, visibility: 'PUBLIC' })
        .expect(201)
    ).body.slug as string;
    const me = await ctx.http().get('/api/v1/me').set(auth(token)).expect(200);

    expect(me.body.minorAccount).toBe(true);

    const category = await ctx
      .http()
      .get(`/api/v1/forum/categories/${slug}/topics`)
      .set(auth(token))
      .expect(200);

    expect(category.body.category.canPost).toBe(false);
    await ctx
      .http()
      .post(`/api/v1/forum/categories/${slug}/topics`)
      .set(auth(token))
      .send({ title: 'Oi, pessoal', content: 'Primeira mensagem.' })
      .expect(403);
    await ctx
      .http()
      .put('/api/v1/me/profile-visibility')
      .set(auth(token))
      .send({ public: true })
      .expect(403);
  });

  it('conta de adulto não tem as restrições de menor', async () => {
    const adult = await tokenFor(ctx, ['user']);
    const me = await ctx.http().get('/api/v1/me').set(auth(adult.token)).expect(200);

    expect(me.body.minorAccount).toBe(false);
  });
});
