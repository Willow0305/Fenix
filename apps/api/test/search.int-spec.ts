import { randomUUID } from 'node:crypto';

import { createTestContext, type TestContext, tokenFor } from './helpers';

describe('Busca global do painel (DT-057)', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const suffix = randomUUID().slice(0, 6);

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    await ctx.prisma.athlete.create({
      data: { fullName: `João Ávila Busca ${suffix}`, status: 'ACTIVE' }
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const search = (q: string, token = board.token) =>
    ctx.http().get('/api/v1/search').query({ q }).set(auth(token));

  it('encontra sem diferenciar acentos nem maiúsculas e aponta a ficha', async () => {
    const response = await search(`joao avila busca ${suffix}`).expect(200);
    const athletes = response.body.find((group: { key: string }) => group.key === 'athletes');

    expect(athletes.label).toBe('Atletas');
    expect(athletes.hits).toHaveLength(1);
    expect(athletes.hits[0]).toMatchObject({
      title: `João Ávila Busca ${suffix}`,
      subtitle: 'Ativo'
    });
    expect(athletes.hits[0].link).toMatch(/^\/admin\/atletas\/[0-9a-f-]{36}$/);
  });

  it('curingas digitados não viram "qualquer coisa"', async () => {
    const response = await search('%_%').expect(200);

    expect(response.body).toEqual([]);
  });

  it('exige ao menos 2 letras e acesso ao painel', async () => {
    await search('a').expect(422);

    const member = await tokenFor(ctx, ['user']);

    await search('joao', member.token).expect(403);
  });
});
