import {
  currentTotp,
  createTestContext,
  createUser,
  enrollMfa,
  PASSWORD,
  type TestContext
} from './helpers';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

function deviceCookie(response: { headers: Record<string, unknown> }): string | null {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const found = cookies.find((cookie) => cookie.startsWith('fenix_dv='));

  return found ? (found.split(';')[0] ?? null) : null;
}

describe('Lembrar este navegador na segunda etapa (DT-050)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Conta comum com segunda etapa ativada pela própria pessoa. */
  async function accountWithMfa(): Promise<{ id: string; email: string; secret: string }> {
    const user = await createUser(ctx.prisma, ['user']);
    const first = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const { secret } = await enrollMfa(ctx, user.email, first.body.accessToken as string);

    return { ...user, secret };
  }

  const loginWith = (email: string, cookie?: string) =>
    ctx
      .http()
      .post('/api/v1/auth/login')
      .set('User-Agent', CHROME_WINDOWS)
      .set(cookie ? { Cookie: cookie } : {})
      .send({ email, password: PASSWORD })
      .expect(200);

  async function verify(email: string, secret: string, challengeToken: string, remember: boolean) {
    await ctx.prisma.user.update({ where: { email }, data: { mfaLastUsedStep: null } });

    return ctx
      .http()
      .post('/api/v1/auth/mfa/verify')
      .set('User-Agent', CHROME_WINDOWS)
      .send({ challengeToken, code: currentTotp(secret), rememberDevice: remember })
      .expect(200);
  }

  it('sem marcar, continua pedindo o código', async () => {
    const user = await accountWithMfa();
    const challenge = await loginWith(user.email);
    const verified = await verify(user.email, user.secret, challenge.body.challengeToken, false);

    expect(deviceCookie(verified)).toBeNull();
    expect((await loginWith(user.email)).body.mfaRequired).toBe(true);
  });

  it('navegador lembrado entra só com a senha, com sessão de segunda etapa comprovada', async () => {
    const user = await accountWithMfa();
    const challenge = await loginWith(user.email);
    const verified = await verify(user.email, user.secret, challenge.body.challengeToken, true);
    const cookie = deviceCookie(verified);

    expect(cookie).toMatch(/^fenix_dv=/);
    expect(String(verified.headers['set-cookie'])).toMatch(/HttpOnly/i);

    const again = await loginWith(user.email, cookie ?? '');

    expect(again.body.mfaRequired).toBeUndefined();
    expect(again.body.accessToken).toBeTruthy();

    const session = await ctx.prisma.userSession.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    expect(session.mfaVerifiedAt).not.toBeNull();

    const device = await ctx.prisma.trustedDevice.findFirstOrThrow({ where: { userId: user.id } });

    expect(device.label).toBe('Chrome no Windows');
    expect(device.tokenHash).not.toContain(cookie?.slice('fenix_dv='.length) ?? 'x');
    expect(
      await ctx.prisma.auditLog.count({
        where: { actorUserId: user.id, action: 'auth.trusted_device.created' }
      })
    ).toBe(1);
  });

  it('o cookie de uma conta não dispensa o código de outra', async () => {
    const alice = await accountWithMfa();
    const bob = await accountWithMfa();
    const challenge = await loginWith(alice.email);
    const cookie = deviceCookie(
      await verify(alice.email, alice.secret, challenge.body.challengeToken, true)
    );

    expect((await loginWith(bob.email, cookie ?? '')).body.mfaRequired).toBe(true);
  });

  it('a pessoa vê e esquece navegadores; trocar a senha esquece todos', async () => {
    const user = await accountWithMfa();
    const challenge = await loginWith(user.email);
    const verified = await verify(user.email, user.secret, challenge.body.challengeToken, true);
    const cookie = deviceCookie(verified) ?? '';
    const token = verified.body.accessToken as string;
    const list = await ctx
      .http()
      .get('/api/v1/auth/trusted-devices')
      .set({ Authorization: `Bearer ${token}`, Cookie: cookie })
      .expect(200);

    expect(list.body).toMatchObject([{ label: 'Chrome no Windows', current: true }]);

    await ctx
      .http()
      .post('/api/v1/me/password')
      .set({ Authorization: `Bearer ${token}` })
      .send({ currentPassword: PASSWORD, newPassword: 'Outra-senha-bem-longa-2026' })
      .expect(204);

    expect(
      await ctx.prisma.trustedDevice.count({ where: { userId: user.id, revokedAt: null } })
    ).toBe(0);
  });

  it('esquecer um navegador volta a pedir o código nele', async () => {
    const user = await accountWithMfa();
    const challenge = await loginWith(user.email);
    const verified = await verify(user.email, user.secret, challenge.body.challengeToken, true);
    const cookie = deviceCookie(verified) ?? '';
    const auth = { Authorization: `Bearer ${verified.body.accessToken as string}` };
    const [device] = (await ctx.http().get('/api/v1/auth/trusted-devices').set(auth).expect(200))
      .body as { id: string }[];

    await ctx
      .http()
      .delete(`/api/v1/auth/trusted-devices/${device?.id ?? ''}`)
      .set(auth)
      .expect(204);

    expect((await loginWith(user.email, cookie)).body.mfaRequired).toBe(true);
  });

  it('exige login para listar', async () => {
    await ctx.http().get('/api/v1/auth/trusted-devices').expect(401);
  });
});
