import { randomUUID } from 'node:crypto';

import { createTestContext, createUser, type TestContext, tokenFor } from './helpers';

/** Papéis criados pela administração para cada trabalho (DT-078). */
describe('Papéis e permissões: criar, editar e excluir (DT-078)', () => {
  let ctx: TestContext;
  let admin: { token: string; id: string };
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await tokenFor(ctx, ['admin']);
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('permissões vêm agrupadas por área', async () => {
    const list = await ctx.http().get('/api/v1/permissions').set(auth(admin.token)).expect(200);

    expect(list.body.find((p: { code: string }) => p.code === 'finance.read')).toMatchObject({
      area: 'Caixa e finanças'
    });
  });

  it('administrador cria, edita, dá a uma pessoa e exclui um papel; diretoria não', async () => {
    const name = `Financeiro ${randomUUID().slice(0, 4)}`;

    await ctx
      .http()
      .post('/api/v1/roles')
      .set(auth(board.token))
      .send({ name, permissions: ['finance.read'] })
      .expect(403);

    const created = await ctx
      .http()
      .post('/api/v1/roles')
      .set(auth(admin.token))
      .send({
        name,
        description: 'Caixa e mensalidades',
        permissions: ['finance.read', 'fees.read']
      })
      .expect(201);

    expect(created.body).toMatchObject({
      name,
      isSystem: false,
      permissions: ['fees.read', 'finance.read'],
      userCount: 0
    });

    const code = created.body.code as string;

    await ctx
      .http()
      .post('/api/v1/roles')
      .set(auth(admin.token))
      .send({ name: name.toUpperCase() })
      .expect(409);

    // Copiar outro papel e depois ajustar.
    const copy = await ctx
      .http()
      .post('/api/v1/roles')
      .set(auth(admin.token))
      .send({ name: `Cópia ${randomUUID().slice(0, 4)}`, copyFrom: code })
      .expect(201);

    expect(copy.body.permissions).toEqual(['fees.read', 'finance.read']);

    const renamed = await ctx
      .http()
      .patch(`/api/v1/roles/${code}`)
      .set(auth(admin.token))
      .send({ name: `${name} e Caixa` })
      .expect(200);

    expect(renamed.body.name).toBe(`${name} e Caixa`);

    // Papéis do sistema são fixos.
    await ctx
      .http()
      .patch('/api/v1/roles/board')
      .set(auth(admin.token))
      .send({ name: 'Outra' })
      .expect(403);
    await ctx
      .http()
      .delete('/api/v1/roles/board')
      .set(auth(admin.token))
      .send({ reason: 'Não pode' })
      .expect(403);

    // A pessoa com o papel passa a ter a permissão (e só ela).
    const person = await createUser(ctx.prisma, ['user']);

    await ctx
      .http()
      .put(`/api/v1/users/${person.id}/roles`)
      .set(auth(admin.token))
      .send({ roles: ['user', code], reason: 'Cuida do caixa' })
      .expect(200);

    const holders = await ctx.prisma.userRole.count({
      where: { userId: person.id, role: { code } }
    });

    expect(holders).toBe(1);
    await ctx
      .http()
      .delete(`/api/v1/roles/${code}`)
      .set(auth(admin.token))
      .send({ reason: 'Não usamos mais' })
      .expect(409);
    await ctx
      .http()
      .put(`/api/v1/users/${person.id}/roles`)
      .set(auth(admin.token))
      .send({ roles: ['user'], reason: 'Saiu do caixa' })
      .expect(200);
    await ctx
      .http()
      .delete(`/api/v1/roles/${code}`)
      .set(auth(admin.token))
      .send({ reason: 'Não usamos mais' })
      .expect(204);

    const roles = await ctx.http().get('/api/v1/roles').set(auth(admin.token)).expect(200);

    expect(roles.body.map((r: { code: string }) => r.code)).not.toContain(code);
    await expect(
      ctx.prisma.auditLog.count({ where: { action: { in: ['role.created', 'role.deleted'] } } })
    ).resolves.toBeGreaterThanOrEqual(2);
  });
});
