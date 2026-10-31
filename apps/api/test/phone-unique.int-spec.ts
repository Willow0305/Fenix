import { randomInt } from 'node:crypto';

import { createTestContext, PASSWORD, type TestContext, uniqueEmail } from './helpers';

/** Celular único entre as contas (DT-084), com ou sem máscara. */
describe('Celular único', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  // Número aleatório válido (DDD 68, começa por 9) para não colidir entre execuções.
  const randomMobile = () => `689${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  const register = (phone: string) =>
    ctx
      .http()
      .post('/api/v1/auth/register')
      .send({
        name: 'Pessoa Teste',
        email: uniqueEmail('celular'),
        password: PASSWORD,
        phone,
        acceptTerms: true,
        minimumAgeConfirmed: true
      });

  it('recusa no cadastro o celular de outra conta, mesmo escrito com máscara', async () => {
    const digits = randomMobile();
    const first = await register(
      `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    );

    expect(first.status).toBe(201);

    const me = await ctx.http().get('/api/v1/me').set(auth(first.body.accessToken)).expect(200);

    expect(me.body.phone).toBe(digits);

    const second = await register(digits);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('PHONE_IN_USE');
    expect(second.body.detail).toBe('Este celular já possui cadastro. Entre ou recupere a senha.');
  });

  it('não deixa trocar para o celular de outra conta, mas aceita manter o próprio', async () => {
    const taken = randomMobile();
    const owner = await register(taken).expect(201);
    const other = await register(randomMobile()).expect(201);

    const refused = await ctx
      .http()
      .patch('/api/v1/me')
      .set(auth(other.body.accessToken))
      .send({ phone: taken })
      .expect(409);

    expect(refused.body.code).toBe('PHONE_IN_USE');

    await ctx
      .http()
      .patch('/api/v1/me')
      .set(auth(owner.body.accessToken))
      .send({ phone: taken, name: 'Pessoa Renomeada' })
      .expect(200);
  });
});
