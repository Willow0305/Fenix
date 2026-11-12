import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LoginGuardService } from '../src/modules/auth/application/login-guard.service';
import { createTestContext, createUser, PASSWORD, type TestContext, uniqueEmail } from './helpers';

describe('Freio de tentativas de login por conta (PEN-053, DT-109)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  function attempt(email: string, password: string) {
    return ctx.http().post('/api/v1/auth/login').send({ email, password });
  }

  async function failTimes(email: string, times: number): Promise<void> {
    for (let index = 0; index < times; index += 1) {
      await attempt(email, 'senha-errada-123').expect(401);
    }
  }

  function mailsTo(email: string): string[] {
    return readdirSync(ctx.outboxDir)
      .map((name) => readFileSync(join(ctx.outboxDir, name), 'utf8'))
      .filter((content) => content.includes(`To: ${email}`));
  }

  /** Simula o fim do bloqueio sem esperar o relógio. */
  async function expireLocks(): Promise<void> {
    await ctx.prisma.loginFailureCounter.updateMany({
      where: { lockedUntil: { not: null } },
      data: { lockedUntil: new Date(Date.now() - 1000) }
    });
  }

  it('bloqueia depois de 5 falhas seguidas, mesmo com a senha certa', async () => {
    const user = await createUser(ctx.prisma, ['user']);

    await failTimes(user.email, 4);
    // Ainda livre: a senha certa entra e zera a contagem.
    await attempt(user.email, PASSWORD).expect(200);
    await failTimes(user.email, 5);

    const locked = await attempt(user.email, PASSWORD).expect(429);

    expect(locked.body.code).toBe('LOGIN_TEMPORARILY_LOCKED');
    expect(locked.body.detail).toContain('tente de novo em 1 minuto');
  });

  it('responde igual para e-mail sem cadastro (não revela quem tem conta)', async () => {
    const user = await createUser(ctx.prisma, ['user']);
    const unknown = uniqueEmail('ninguem');

    await failTimes(user.email, 5);
    await failTimes(unknown, 5);

    const known = await attempt(user.email, 'qualquer-senha-1').expect(429);
    const missing = await attempt(unknown, 'qualquer-senha-1').expect(429);

    expect(missing.body.code).toBe(known.body.code);
    expect(missing.body.detail).toBe(known.body.detail);
    expect(mailsTo(unknown)).toHaveLength(0);
  });

  it('avisa o titular uma vez por e-mail e registra na auditoria', async () => {
    const user = await createUser(ctx.prisma, ['user']);

    await failTimes(user.email, 5);
    await expireLocks();
    // Nova falha depois do bloqueio: bloqueia de novo (por mais tempo), sem outro aviso.
    await attempt(user.email, 'senha-errada-123').expect(401);

    const mails = mailsTo(user.email);

    expect(mails).toHaveLength(1);
    expect(mails[0]).toContain('5 tentativas seguidas');
    expect(mails[0]).toContain('/recuperar-senha');
    expect(mails[0]).not.toContain(PASSWORD);

    const audits = await ctx.prisma.auditLog.findMany({
      where: { action: 'auth.login.locked', entityId: user.id }
    });

    expect(audits).toHaveLength(1);

    const again = await attempt(user.email, PASSWORD).expect(429);

    expect(again.body.detail).toContain('2 minutos');
  });

  it('libera quando o bloqueio vence e a senha certa zera a contagem', async () => {
    const user = await createUser(ctx.prisma, ['user']);

    await failTimes(user.email, 5);
    await expireLocks();
    await attempt(user.email, PASSWORD).expect(200);

    // Contagem zerada: 4 novas falhas não bloqueiam.
    await failTimes(user.email, 4);
    await attempt(user.email, PASSWORD).expect(200);
  });

  it('a redefinição de senha libera a conta bloqueada', async () => {
    const user = await createUser(ctx.prisma, ['user']);

    await failTimes(user.email, 5);
    await attempt(user.email, PASSWORD).expect(429);
    await ctx.http().post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(202);

    const resetMail = mailsTo(user.email).find((content) => content.includes('token='));
    const token = decodeURIComponent(/token=([^\s]+)/.exec(resetMail ?? '')?.[1] ?? '');

    await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token, password: 'redefinida-forte-77' })
      .expect(204);
    await attempt(user.email, 'redefinida-forte-77').expect(200);
  });

  it('não guarda o e-mail em claro e a limpeza apaga sequências antigas', async () => {
    const email = uniqueEmail('limpeza');
    const guard = ctx.app.get(LoginGuardService);

    await failTimes(email, 1);

    const rows = await ctx.prisma.$queryRaw<{ found: bigint }[]>`
      SELECT count(*) AS found FROM "login_failure_counters" WHERE "key_hash" LIKE ${`%${email}%`}`;

    expect(Number(rows[0]?.found)).toBe(0);

    const dayLater = new Date(Date.now() + 24 * 60 * 60 * 1000 + 1000);
    const removed = await guard.cleanup(dayLater);

    expect(removed).toBeGreaterThanOrEqual(1);
    // Depois da limpeza, a sequência recomeça do zero.
    await failTimes(email, 4);
    await attempt(email, 'senha-errada-123').expect(401);
  });
});
