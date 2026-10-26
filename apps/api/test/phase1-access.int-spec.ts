import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createTestContext,
  createUser,
  login,
  PASSWORD,
  PNG_1X1,
  refreshCookieFrom,
  type TestContext,
  tokenFor,
  uniqueEmail
} from './helpers';

describe('Fase 1 — autenticação, permissões e configurações', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  describe('cadastro e login', () => {
    it('cadastra usuário comum e nunca aceita papel privilegiado vindo do cliente', async () => {
      const email = uniqueEmail('cadastro');
      const response = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({
          name: 'Ana Teste',
          email,
          password: PASSWORD,
          acceptTerms: true,
          minimumAgeConfirmed: true
        })
        .expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(refreshCookieFrom(response)).toMatch(/^fenix_rt=/);
      expect(String(response.headers['set-cookie'])).toMatch(/HttpOnly/);
      expect(String(response.headers['set-cookie'])).toMatch(/SameSite=Strict/);

      const me = await ctx
        .http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);

      expect(me.body.roles).toEqual(['user']);
      expect(me.body.permissions).toEqual([]);

      await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({
          name: 'Intruso',
          email: uniqueEmail(),
          password: PASSWORD,
          acceptTerms: true,
          minimumAgeConfirmed: true,
          roles: ['admin']
        })
        .expect(422);
    });

    it('valida termos, declaração de idade, política de senha e duplicidade', async () => {
      const base = {
        name: 'Bia',
        email: uniqueEmail(),
        password: PASSWORD,
        acceptTerms: true,
        minimumAgeConfirmed: true
      };

      await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ ...base, acceptTerms: false })
        .expect(422);
      await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ ...base, minimumAgeConfirmed: false })
        .expect(422);
      const weak = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ ...base, password: 'curta' })
        .expect(422);

      expect(weak.body.code).toBe('WEAK_PASSWORD');
      await ctx.http().post('/api/v1/auth/register').send(base).expect(201);
      await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ ...base, email: base.email.toUpperCase() })
        .expect(409);
    });

    it('usa o mesmo erro genérico para e-mail desconhecido e senha errada', async () => {
      const user = await createUser(ctx.prisma, ['user']);
      const wrong = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'errada-123456' })
        .expect(401);
      const unknown = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'errada-123456' })
        .expect(401);

      expect(wrong.body.detail).toBe(unknown.body.detail);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('bloqueia contas inativas', async () => {
      const user = await createUser(ctx.prisma, ['user']);

      await ctx.prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });
      await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(403);
    });
  });

  describe('sessões', () => {
    it('renova o token, detecta reuso e revoga todas as sessões', async () => {
      const user = await createUser(ctx.prisma, ['user']);
      const first = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      const cookie1 = refreshCookieFrom(first);
      const second = await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie1)
        .expect(200);
      const cookie2 = refreshCookieFrom(second);

      expect(cookie2).not.toBe(cookie1);

      // Simula reapresentação do token antigo fora da janela de tolerância.
      await ctx.prisma.userSession.updateMany({
        where: { userId: user.id, revocationReason: 'ROTATED' },
        data: { revokedAt: new Date(Date.now() - 60_000) }
      });
      await ctx.http().post('/api/v1/auth/refresh').set('Cookie', cookie1).expect(401);
      await ctx.http().post('/api/v1/auth/refresh').set('Cookie', cookie2).expect(401);
      await ctx
        .http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(401);

      const audit = await ctx.prisma.auditLog.count({
        where: { actorUserId: user.id, action: 'auth.refresh.reuse_detected' }
      });

      expect(audit).toBe(1);
    });

    it('recusa renovação vinda de outra origem', async () => {
      const user = await createUser(ctx.prisma, ['user']);
      const response = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD });

      await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookieFrom(response))
        .set('Origin', 'https://malicioso.example')
        .expect(403);
    });

    it('sair invalida a sessão e o token de acesso', async () => {
      const user = await createUser(ctx.prisma, ['user']);
      const response = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD });
      const cookie = refreshCookieFrom(response);

      await ctx.http().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
      await ctx.http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
      await ctx
        .http()
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(401);
    });

    it('trocar a senha mantém a sessão atual e revoga as outras', async () => {
      const user = await createUser(ctx.prisma, ['user']);
      const current = await login(ctx, user.email);
      const other = await login(ctx, user.email);

      await ctx
        .http()
        .post('/api/v1/me/password')
        .set('Authorization', `Bearer ${current}`)
        .send({ currentPassword: PASSWORD, newPassword: 'nova-senha-forte-77' })
        .expect(204);
      await ctx.http().get('/api/v1/me').set('Authorization', `Bearer ${current}`).expect(200);
      await ctx.http().get('/api/v1/me').set('Authorization', `Bearer ${other}`).expect(401);
      await login(ctx, user.email, 'nova-senha-forte-77');
    });

    describe('inatividade e duração máxima (DT-036)', () => {
      const ago = (seconds: number): Date => new Date(Date.now() - seconds * 1000);

      async function openSession(roles: string[]) {
        const user = await createUser(ctx.prisma, roles);
        const response = await ctx
          .http()
          .post('/api/v1/auth/login')
          .send({ email: user.email, password: PASSWORD })
          .expect(200);

        return {
          user,
          cookie: refreshCookieFrom(response),
          accessToken: (response.body as { accessToken: string }).accessToken,
          idleTimeoutSeconds: (response.body as { idleTimeoutSeconds: number }).idleTimeoutSeconds
        };
      }

      it('encerra sessão administrativa parada ao renovar e registra na auditoria', async () => {
        const { user, cookie, accessToken, idleTimeoutSeconds } = await openSession(['admin']);

        expect(idleTimeoutSeconds).toBe(30 * 60);
        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id },
          data: { lastActivityAt: ago(31 * 60) }
        });
        await ctx
          .http()
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookie)
          .send({ active: true })
          .expect(401);
        await ctx
          .http()
          .get('/api/v1/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401);

        const session = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id }
        });

        expect(session.revocationReason).toBe('IDLE_TIMEOUT');
        expect(
          await ctx.prisma.auditLog.count({
            where: { actorUserId: user.id, action: 'auth.session.expired' }
          })
        ).toBe(1);
      });

      it('recusa o token de acesso de sessão parada antes de qualquer renovação', async () => {
        const { user, accessToken } = await openSession(['board']);

        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id },
          data: { lastActivityAt: ago(31 * 60) }
        });
        await ctx
          .http()
          .get('/api/v1/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401);
      });

      it('mantém o usuário comum conectado por horas, mas não além de 7 dias parado', async () => {
        const { user, cookie, idleTimeoutSeconds } = await openSession(['user']);

        expect(idleTimeoutSeconds).toBe(7 * 24 * 60 * 60);
        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id },
          data: { lastActivityAt: ago(6 * 60 * 60) }
        });
        const renewed = await ctx
          .http()
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookie)
          .expect(200);

        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { lastActivityAt: ago(7 * 24 * 60 * 60 + 60) }
        });
        await ctx
          .http()
          .post('/api/v1/auth/refresh')
          .set('Cookie', refreshCookieFrom(renewed))
          .expect(401);
      });

      it('renovação automática não conta como uso; atividade informada conta', async () => {
        const { user, cookie } = await openSession(['admin']);
        const old = ago(10 * 60);

        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id },
          data: { lastActivityAt: old }
        });
        const passive = await ctx
          .http()
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookie)
          .expect(200);
        const afterPassive = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id, revokedAt: null }
        });

        expect(afterPassive.lastActivityAt.getTime()).toBe(old.getTime());

        await ctx
          .http()
          .post('/api/v1/auth/refresh')
          .set('Cookie', refreshCookieFrom(passive))
          .send({ active: true })
          .expect(200);
        const afterActive = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id, revokedAt: null }
        });

        expect(afterActive.lastActivityAt.getTime()).toBeGreaterThan(Date.now() - 5_000);
      });

      it('requisições autenticadas registram atividade', async () => {
        const { user, accessToken } = await openSession(['admin']);

        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id },
          data: { lastActivityAt: ago(5 * 60) }
        });
        await ctx
          .http()
          .get('/api/v1/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const session = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id }
        });

        expect(session.lastActivityAt.getTime()).toBeGreaterThan(Date.now() - 5_000);
      });

      it('encerra sessão administrativa 12 horas depois do login, mesmo com uso constante', async () => {
        const { user, cookie } = await openSession(['admin']);

        await ctx.prisma.userSession.updateMany({
          where: { userId: user.id },
          data: { authenticatedAt: ago(12 * 60 * 60), lastActivityAt: new Date() }
        });
        await ctx
          .http()
          .post('/api/v1/auth/refresh')
          .set('Cookie', cookie)
          .send({ active: true })
          .expect(401);

        const session = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id }
        });

        expect(session.revocationReason).toBe('ABSOLUTE_TIMEOUT');
      });

      it('a renovação mantém o instante do login e o prazo máximo', async () => {
        const { user, cookie } = await openSession(['user']);
        const first = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id }
        });

        await ctx.http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
        const rotated = await ctx.prisma.userSession.findFirstOrThrow({
          where: { userId: user.id, revokedAt: null }
        });

        expect(rotated.id).not.toBe(first.id);
        expect(rotated.authenticatedAt.getTime()).toBe(first.authenticatedAt.getTime());
        expect(rotated.expiresAt.getTime()).toBe(first.expiresAt.getTime());
      });
    });
  });

  describe('recuperação de senha', () => {
    it('não revela contas e redefine com token de uso único', async () => {
      const user = await createUser(ctx.prisma, ['user']);
      const unknown = await ctx
        .http()
        .post('/api/v1/auth/password/forgot')
        .send({ email: uniqueEmail() })
        .expect(202);
      const known = await ctx
        .http()
        .post('/api/v1/auth/password/forgot')
        .send({ email: user.email })
        .expect(202);

      expect(known.body).toEqual(unknown.body);

      const file = readdirSync(ctx.outboxDir)
        .map((name) => readFileSync(join(ctx.outboxDir, name), 'utf8'))
        .find((content) => content.includes(`To: ${user.email}`));
      const token = decodeURIComponent(/token=([^\s]+)/.exec(file ?? '')?.[1] ?? '');

      expect(token.length).toBeGreaterThan(20);
      await ctx
        .http()
        .post('/api/v1/auth/password/reset')
        .send({ token, password: 'redefinida-forte-88' })
        .expect(204);
      await ctx
        .http()
        .post('/api/v1/auth/password/reset')
        .send({ token, password: 'outra-senha-forte-99' })
        .expect(422);
      await login(ctx, user.email, 'redefinida-forte-88');
    });
  });

  describe('autorização administrativa', () => {
    it('nega acesso sem permissão e registra a tentativa', async () => {
      const { token, id } = await tokenFor(ctx, ['user']);

      await ctx.http().get('/api/v1/users').set('Authorization', `Bearer ${token}`).expect(403);
      expect(
        await ctx.prisma.auditLog.count({ where: { actorUserId: id, action: 'access.denied' } })
      ).toBe(1);
    });

    it('diretoria não gerencia papéis; administrador gerencia, com auditoria e proteção da própria conta', async () => {
      const board = await tokenFor(ctx, ['board']);
      const admin = await tokenFor(ctx, ['admin']);
      const target = await createUser(ctx.prisma, ['user']);

      await ctx
        .http()
        .put(`/api/v1/users/${target.id}/roles`)
        .set('Authorization', `Bearer ${board.token}`)
        .send({ roles: ['admin'], reason: 'tentativa' })
        .expect(403);

      const changed = await ctx
        .http()
        .put(`/api/v1/users/${target.id}/roles`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ roles: ['athlete', 'user'], reason: 'Atleta aprovada na seletiva' })
        .expect(200);

      expect(changed.body.roles).toEqual(['athlete', 'user']);
      await ctx
        .http()
        .put(`/api/v1/users/${admin.id}/roles`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ roles: ['user'], reason: 'autorremoção' })
        .expect(403);

      const log = await ctx.prisma.auditLog.findFirst({
        where: { entityId: target.id, action: 'user.roles.changed' }
      });

      expect(log?.reason).toBe('Atleta aprovada na seletiva');
      expect(log?.actorUserId).toBe(admin.id);
    });

    it('desativar usuário revoga as sessões na hora', async () => {
      const admin = await tokenFor(ctx, ['admin']);
      const target = await tokenFor(ctx, ['user']);

      await ctx
        .http()
        .put(`/api/v1/users/${target.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'BLOCKED', reason: 'Teste de bloqueio' })
        .expect(200);
      await ctx.http().get('/api/v1/me').set('Authorization', `Bearer ${target.token}`).expect(401);
    });

    it('lista a auditoria só com audit.read', async () => {
      const admin = await tokenFor(ctx, ['admin']);
      const board = await tokenFor(ctx, ['board']);

      await ctx
        .http()
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${board.token}`)
        .expect(403);
      const page = await ctx
        .http()
        .get('/api/v1/audit-logs?pageSize=5')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(page.body.meta.pageSize).toBe(5);
      expect(JSON.stringify(page.body)).not.toMatch(/passwordHash|refreshToken/);
    });
  });

  describe('configurações do time', () => {
    it('atualiza dados públicos e mantém os financeiros privados e cifrados', async () => {
      const admin = await tokenFor(ctx, ['admin']);
      const user = await tokenFor(ctx, ['user']);

      await ctx
        .http()
        .patch('/api/v1/team-settings')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          phone: '(68) 99999-0000',
          socialLinks: [{ label: 'Instagram', url: 'https://instagram.com/fenix' }]
        })
        .expect(200);
      await ctx
        .http()
        .put('/api/v1/team-settings/financial')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ pixKey: 'pix@fenix.example' })
        .expect(200);

      const pub = await ctx.http().get('/api/v1/public/team').expect(200);

      // Telefone é gravado só com dígitos (DT-040).
      expect(pub.body.phone).toBe('68999990000');
      expect(JSON.stringify(pub.body)).not.toContain('pix@fenix.example');

      const row = await ctx.prisma.teamSettings.findFirstOrThrow();

      expect(row.pixKeyEncrypted).not.toContain('pix@fenix.example');
      await ctx
        .http()
        .patch('/api/v1/team-settings')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ phone: '1' })
        .expect(403);

      const payment = await ctx
        .http()
        .get('/api/v1/team-settings/payment-info')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(payment.body.pixKey).toBe('pix@fenix.example');
    });

    it('envia logo validada e recusa arquivo disfarçado', async () => {
      const board = await tokenFor(ctx, ['board']);
      const uploaded = await ctx
        .http()
        .put('/api/v1/team-settings/brand-assets/OFFICIAL')
        .set('Authorization', `Bearer ${board.token}`)
        .field('altText', 'Brasão Fênix')
        .attach('file', PNG_1X1, 'logo.png')
        .expect(200);
      const url = uploaded.body.brandAssets.OFFICIAL.url as string;

      // Imagens públicas são otimizadas e gravadas em WebP (DT-039).
      await ctx.http().get(url).expect(200).expect('Content-Type', 'image/webp');
      await ctx
        .http()
        .put('/api/v1/team-settings/brand-assets/MALE')
        .set('Authorization', `Bearer ${board.token}`)
        .attach('file', PNG_1X1.subarray(0, 40), 'logo.png')
        .expect(422);
      await ctx
        .http()
        .put('/api/v1/team-settings/brand-assets/MALE')
        .set('Authorization', `Bearer ${board.token}`)
        .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), 'logo.png')
        .expect(415);
      await ctx
        .http()
        .put('/api/v1/team-settings/brand-assets/MALE')
        .set('Authorization', `Bearer ${board.token}`)
        .attach('file', PNG_1X1, 'logo.pdf')
        .expect(415);
    });
  });
});
