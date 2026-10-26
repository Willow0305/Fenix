import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Listas que crescem: filtros e paginação', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const get = (path: string, query: Record<string, string | number> = {}) =>
    ctx.http().get(`/api/v1${path}`).query(query).set(auth(board.token)).expect(200);

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  it('interessados: em aberto não mostra arquivados; encerrados sim', async () => {
    const tag = randomUUID().slice(0, 6);
    const person = (status: 'NEW' | 'ARCHIVED') =>
      ctx.prisma.interestedPerson.create({
        data: {
          fullName: `Lista ${tag} ${status}`,
          email: `${status.toLowerCase()}-${tag}@exemplo.test`,
          phone: '68999990000',
          status
        }
      });

    await person('NEW');
    await person('ARCHIVED');

    const open = await get('/interested-people', { scope: 'open', search: `Lista ${tag}` });
    const closed = await get('/interested-people', { scope: 'closed', search: `Lista ${tag}` });

    expect(open.body.data.map((p: { status: string }) => p.status)).toEqual(['NEW']);
    expect(closed.body.data.map((p: { status: string }) => p.status)).toEqual(['ARCHIVED']);
  });

  it('seletivas: em andamento e encerradas separadas e paginadas', async () => {
    const tag = randomUUID().slice(0, 6);

    for (const status of ['OPEN', 'COMPLETED'] as const) {
      await ctx.prisma.tryout.create({
        data: {
          title: `Seletiva ${tag} ${status}`,
          slug: `sel-${tag}-${status.toLowerCase()}`,
          status
        }
      });
    }

    const active = await get('/tryouts', { scope: 'active', search: tag });
    const finished = await get('/tryouts', { scope: 'finished', search: tag });

    expect(active.body.meta).toMatchObject({ page: 1 });
    expect(active.body.data.map((t: { status: string }) => t.status)).toEqual(['OPEN']);
    expect(finished.body.data.map((t: { status: string }) => t.status)).toEqual(['COMPLETED']);
  });

  it('fechamentos e avisos enviados vêm em páginas', async () => {
    const closings = await get('/finance/closings', { pageSize: 5 });
    const broadcasts = await get('/notifications/broadcasts', { pageSize: 5 });

    expect(closings.body).toMatchObject({ meta: { page: 1, pageSize: 5 } });
    expect(Array.isArray(closings.body.data)).toBe(true);
    expect(broadcasts.body).toMatchObject({ meta: { page: 1, pageSize: 5 } });
  });
});
