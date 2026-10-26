import { totpCode, totpStep } from '../src/common/crypto/totp';
import {
  createTestContext,
  createUser,
  currentTotp,
  enrollMfa,
  login,
  PASSWORD,
  refreshCookieFrom,
  type TestContext
} from './helpers';

/** Login em duas etapas por aplicativo autenticador (DT-037). */
describe('Segunda etapa (MFA/TOTP)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function passwordLogin(email: string) {
    return ctx.http().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('bloqueia o painel até ativar a segunda etapa', async () => {
    const admin = await createUser(ctx.prisma, ['admin']);
    const token = (await passwordLogin(admin.email)).body.accessToken as string;
    const me = await ctx.http().get('/api/v1/me').set(auth(token)).expect(200);

    expect(me.body.mfa).toEqual({ enabled: false, required: true, verified: false });
    expect(me.body.permissions).toEqual(['forum.members.access']);

    const denied = await ctx.http().get('/api/v1/users').set(auth(token)).expect(403);

    expect(denied.body.code).toBe('MFA_REQUIRED');
  });

  it('ativa com senha e código válido, libera a sessão atual e encerra as outras', async () => {
    const admin = await createUser(ctx.prisma, ['admin']);
    const current = (await passwordLogin(admin.email)).body.accessToken as string;
    const other = (await passwordLogin(admin.email)).body.accessToken as string;

    await ctx
      .http()
      .post('/api/v1/me/mfa/setup')
      .set(auth(current))
      .send({ password: 'senha-errada-123' })
      .expect(422);
    const setup = await ctx
      .http()
      .post('/api/v1/me/mfa/setup')
      .set(auth(current))
      .send({ password: PASSWORD })
      .expect(200);

    expect(setup.body.otpauthUri).toContain('otpauth://totp/');
    expect(setup.body.qrSvg).toContain('<svg');

    await ctx
      .http()
      .post('/api/v1/me/mfa/enable')
      .set(auth(current))
      .send({ code: '000000' })
      .expect(422);
    const enabled = await ctx
      .http()
      .post('/api/v1/me/mfa/enable')
      .set(auth(current))
      .send({ code: currentTotp(setup.body.secret as string) })
      .expect(200);

    expect(enabled.body.recoveryCodes).toHaveLength(10);
    await ctx.http().get('/api/v1/users').set(auth(current)).expect(200);
    await ctx.http().get('/api/v1/me').set(auth(other)).expect(401);

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: admin.id } });

    expect(user.mfaSecretEncrypted).not.toContain(setup.body.secret as string);
    expect(user.mfaPendingSecretEncrypted).toBeNull();
  });

  it('pede o código depois da senha e recusa código reutilizado', async () => {
    const admin = await createUser(ctx.prisma, ['admin']);
    const first = (await passwordLogin(admin.email)).body.accessToken as string;
    const { secret } = await enrollMfa(ctx, admin.email, first);
    const challenge = await passwordLogin(admin.email);

    expect(challenge.body).toMatchObject({ mfaRequired: true });
    expect(challenge.body.accessToken).toBeUndefined();
    expect(challenge.headers['set-cookie']).toBeUndefined();

    // O código usado na ativação já foi consumido.
    const used = await ctx.prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    const reused = totpCode(secret, used.mfaLastUsedStep ?? totpStep(new Date()));

    await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.body.challengeToken, code: reused })
      .expect(401);

    const next = totpCode(secret, (used.mfaLastUsedStep ?? 0) + 1);
    const verified = await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.body.challengeToken, code: next })
      .expect(200);

    refreshCookieFrom(verified);
    await ctx
      .http()
      .get('/api/v1/users')
      .set(auth(verified.body.accessToken as string))
      .expect(200);
    await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.body.challengeToken, code: next })
      .expect(401);
  });

  it('bloqueia o desafio depois de 5 códigos errados', async () => {
    const admin = await createUser(ctx.prisma, ['board']);
    const { secret } = await enrollMfa(
      ctx,
      admin.email,
      (await passwordLogin(admin.email)).body.accessToken as string
    );
    const challenge = (await passwordLogin(admin.email)).body.challengeToken as string;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await ctx
        .http()
        .post('/api/v1/auth/mfa/verify')
        .send({ challengeToken: challenge, code: '000000' })
        .expect(401);
    }

    await ctx.prisma.user.update({ where: { id: admin.id }, data: { mfaLastUsedStep: null } });
    await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge, code: currentTotp(secret) })
      .expect(401);
    expect(
      await ctx.prisma.auditLog.count({
        where: { actorUserId: admin.id, action: 'auth.mfa.failed' }
      })
    ).toBe(5);
  });

  it('aceita cada código de recuperação uma única vez', async () => {
    const admin = await createUser(ctx.prisma, ['admin']);
    const { recoveryCodes } = await enrollMfa(
      ctx,
      admin.email,
      (await passwordLogin(admin.email)).body.accessToken as string
    );
    const code = recoveryCodes[0] ?? '';
    const first = (await passwordLogin(admin.email)).body.challengeToken as string;

    await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: first, code: code.toLowerCase() })
      .expect(200);
    const second = (await passwordLogin(admin.email)).body.challengeToken as string;

    await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: second, code })
      .expect(401);
    const status = await ctx
      .http()
      .get('/api/v1/me/mfa')
      .set(auth(await login(ctx, admin.email)))
      .expect(200);

    expect(status.body.recoveryCodesRemaining).toBe(9);
  });

  it('mantém a segunda etapa obrigatória para perfis privilegiados', async () => {
    const admin = await createUser(ctx.prisma, ['admin']);
    const token = await login(ctx, admin.email);
    const denied = await ctx
      .http()
      .post('/api/v1/me/mfa/disable')
      .set(auth(token))
      .send({ password: PASSWORD, code: '123456' })
      .expect(403);

    expect(denied.body.code).toBe('MFA_MANDATORY');
  });

  it('permite que um usuário comum ative e desative', async () => {
    const user = await createUser(ctx.prisma, ['user']);
    const token = (await passwordLogin(user.email)).body.accessToken as string;
    const { secret } = await enrollMfa(ctx, user.email, token);

    await ctx.prisma.user.update({ where: { id: user.id }, data: { mfaLastUsedStep: null } });
    await ctx
      .http()
      .post('/api/v1/me/mfa/disable')
      .set(auth(token))
      .send({ password: PASSWORD, code: currentTotp(secret) })
      .expect(204);

    const after = await passwordLogin(user.email);

    expect(after.body.accessToken).toBeDefined();
  });

  it('só administrador com segunda etapa comprovada redefine a de outra pessoa, encerrando as sessões dela', async () => {
    const target = await createUser(ctx.prisma, ['board']);
    const targetToken = await login(ctx, target.email);
    const admin = await createUser(ctx.prisma, ['admin']);
    const adminToken = await login(ctx, admin.email);
    const boardToken = await login(ctx, (await createUser(ctx.prisma, ['board'])).email);

    await ctx
      .http()
      .post(`/api/v1/users/${target.id}/mfa/reset`)
      .set(auth(boardToken))
      .send({ reason: 'Perdeu o celular' })
      .expect(403);
    await ctx
      .http()
      .post(`/api/v1/users/${admin.id}/mfa/reset`)
      .set(auth(adminToken))
      .send({ reason: 'Teste de autoproteção' })
      .expect(403);
    await ctx
      .http()
      .post(`/api/v1/users/${target.id}/mfa/reset`)
      .set(auth(adminToken))
      .send({ reason: 'Perdeu o celular' })
      .expect(204);

    await ctx.http().get('/api/v1/me').set(auth(targetToken)).expect(401);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: target.id } });

    expect(user.mfaEnabledAt).toBeNull();
    expect(await ctx.prisma.mfaRecoveryCode.count({ where: { userId: target.id } })).toBe(0);
    expect(
      await ctx.prisma.auditLog.count({ where: { entityId: target.id, action: 'auth.mfa.reset' } })
    ).toBe(1);
  });

  it('mantém a verificação ao renovar o token', async () => {
    const admin = await createUser(ctx.prisma, ['admin']);
    const { secret } = await enrollMfa(
      ctx,
      admin.email,
      (await passwordLogin(admin.email)).body.accessToken as string
    );
    const challenge = (await passwordLogin(admin.email)).body.challengeToken as string;

    await ctx.prisma.user.update({ where: { id: admin.id }, data: { mfaLastUsedStep: null } });
    const verified = await ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge, code: currentTotp(secret) })
      .expect(200);
    const rotated = await ctx
      .http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieFrom(verified))
      .expect(200);

    await ctx
      .http()
      .get('/api/v1/users')
      .set(auth(rotated.body.accessToken as string))
      .expect(200);
  });
});
