import {
  createTestContext,
  createUser,
  login,
  type TestContext,
  randomCpf,
  tokenFor,
  uniqueEmail
} from './helpers';

const ADULT = { birthDate: '1998-04-10' };
const MINOR = { birthDate: '2011-03-01' };

describe('Fase 2 — atletas, equipes, interessados e seletivas', () => {
  let ctx: TestContext;
  let board: { token: string; id: string };
  let auth: (token: string) => { Authorization: string };

  beforeAll(async () => {
    ctx = await createTestContext();
    board = await tokenFor(ctx, ['board']);
    auth = (token) => ({ Authorization: `Bearer ${token}` });
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function createTeam(name: string): Promise<string> {
    const res = await ctx
      .http()
      .post('/api/v1/teams')
      .set(auth(board.token))
      .send({ name, type: 'FEMALE' })
      .expect(201);

    return res.body.id as string;
  }

  async function createOpenTryout(maxSlots?: number): Promise<{ id: string; slug: string }> {
    const created = await ctx
      .http()
      .post('/api/v1/tryouts')
      .set(auth(board.token))
      .send({
        title: `Seletiva ${Date.now()}`,
        location: 'Ginásio',
        ...(maxSlots ? { maxSlots } : {})
      })
      .expect(201);

    await ctx
      .http()
      .put(`/api/v1/tryouts/${created.body.id}/status`)
      .set(auth(board.token))
      .send({ status: 'OPEN' })
      .expect(200);

    return { id: created.body.id, slug: created.body.slug };
  }

  function applicant(overrides: Record<string, unknown> = {}) {
    return {
      fullName: 'Candidata Teste',
      email: uniqueEmail('cand'),
      phone: '68 99999-1111',
      privacyConsent: true,
      ...ADULT,
      ...overrides
    };
  }

  it('recusa equipe inativa em seletiva nova, mas mantém a de quem já usava (COR-008)', async () => {
    const teamId = await createTeam(`Antiga ${Date.now()}`);
    const tryout = await ctx
      .http()
      .post('/api/v1/tryouts')
      .set(auth(board.token))
      .send({ title: `Seletiva ${Date.now()}`, teamId })
      .expect(201);

    await ctx
      .http()
      .patch(`/api/v1/teams/${teamId}`)
      .set(auth(board.token))
      .send({ isActive: false })
      .expect(200);

    const refused = await ctx
      .http()
      .post('/api/v1/tryouts')
      .set(auth(board.token))
      .send({ title: `Seletiva ${Date.now()}`, teamId })
      .expect(422);

    expect(refused.body.code).toBe('INVALID_TEAM');
    await ctx
      .http()
      .patch(`/api/v1/tryouts/${tryout.body.id}`)
      .set(auth(board.token))
      .send({ title: 'Seletiva renomeada', teamId })
      .expect(200);
  });

  describe('atletas', () => {
    it('aceita só CPF válido e telefone com DDD, gravando apenas dígitos (DT-040)', async () => {
      const send = (body: Record<string, unknown>) =>
        ctx
          .http()
          .post('/api/v1/athletes')
          .set(auth(board.token))
          .send({ fullName: `Atleta ${Date.now()}`, ...ADULT, ...body });
      const fields = async (body: Record<string, unknown>) =>
        ((await send(body).expect(422)).body.errors as { field: string }[]).map((e) => e.field);

      expect(await fields({ documentNumber: '12.345.678-9' })).toContain('documentNumber');
      expect(await fields({ documentNumber: '529.982.247-24' })).toContain('documentNumber');
      expect(await fields({ phone: '99999-0000' })).toContain('phone');
      expect(await fields({ guardianPhone: '(10) 99999-0000' })).toContain('guardianPhone');

      const created = await send({ phone: '(68) 99999-1234' }).expect(201);

      expect(created.body.phone).toBe('68999991234');
    });

    it('creates an athlete, tracks history and blocks duplicates', async () => {
      const name = `Atleta ${Date.now()}`;
      const created = await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({
          fullName: name,
          ...ADULT,
          position: 'Levantadora',
          documentNumber: randomCpf()
        })
        .expect(201);

      expect(created.body.status).toBe('PENDING');
      expect(created.body.documentNumberMasked).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
      expect(created.body.documentNeedsReview).toBe(false);

      await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({ fullName: name, ...ADULT })
        .expect(409);

      await ctx
        .http()
        .patch(`/api/v1/athletes/${created.body.id}`)
        .set(auth(board.token))
        .send({ position: 'Ponteira' })
        .expect(200);

      const history = await ctx.prisma.auditLog.findFirst({
        where: { entityId: created.body.id, action: 'athlete.updated' }
      });

      expect(history?.beforeData).toEqual({ position: 'Levantadora' });
      expect(history?.afterData).toEqual({ position: 'Ponteira' });
    });

    it('requires guardian data for minors and acknowledgement under 12', async () => {
      const minor = await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({ fullName: `Menor ${Date.now()}`, ...MINOR })
        .expect(422);

      expect(minor.body.errors.map((e: { field: string }) => e.field)).toEqual([
        'guardianName',
        'guardianPhone'
      ]);

      const child = {
        fullName: `Criança ${Date.now()}`,
        birthDate: '2017-01-01',
        guardianName: 'Responsável',
        guardianPhone: '68 98888-0000'
      };

      await ctx.http().post('/api/v1/athletes').set(auth(board.token)).send(child).expect(422);
      await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({ ...child, guardianAcknowledged: true })
        .expect(201);
    });

    it('enforces status transitions with reason', async () => {
      const created = await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({ fullName: `Status ${Date.now()}` })
        .expect(201);
      const url = `/api/v1/athletes/${created.body.id}/status`;

      await ctx.http().put(url).set(auth(board.token)).send({ status: 'ACTIVE' }).expect(422);
      await ctx
        .http()
        .put(url)
        .set(auth(board.token))
        .send({ status: 'ACTIVE', reason: 'Documentação ok' })
        .expect(200);
      const invalid = await ctx
        .http()
        .put(url)
        .set(auth(board.token))
        .send({ status: 'PENDING', reason: 'voltar' })
        .expect(409);

      expect(invalid.body.code).toBe('INVALID_TRANSITION');
    });

    it('keeps membership history and prevents overlap', async () => {
      const teamId = await createTeam(`Feminino ${Date.now()}`);
      const athlete = await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({ fullName: `Vínculo ${Date.now()}` })
        .expect(201);
      const base = `/api/v1/athletes/${athlete.body.id}/memberships`;
      const added = await ctx
        .http()
        .post(base)
        .set(auth(board.token))
        .send({ teamId, startsOn: '2026-01-01' })
        .expect(201);

      await ctx
        .http()
        .post(base)
        .set(auth(board.token))
        .send({ teamId, startsOn: '2026-03-01' })
        .expect(409);

      const membershipId = added.body.memberships[0].id as string;

      await ctx
        .http()
        .post(`${base}/${membershipId}/end`)
        .set(auth(board.token))
        .send({ endsOn: '2026-06-30', reason: 'Fim da temporada' })
        .expect(201);

      const again = await ctx
        .http()
        .post(base)
        .set(auth(board.token))
        .send({ teamId, startsOn: '2026-08-01' })
        .expect(201);

      expect(again.body.memberships).toHaveLength(2);
      expect(again.body.teams).toHaveLength(1);
    });

    it('lets a linked athlete see only their own record', async () => {
      const person = await createUser(ctx.prisma, ['user']);
      const other = await createUser(ctx.prisma, ['user']);
      const athlete = await ctx
        .http()
        .post('/api/v1/athletes')
        .set(auth(board.token))
        .send({ fullName: `Conta ${Date.now()}` })
        .expect(201);

      await ctx
        .http()
        .put(`/api/v1/athletes/${athlete.body.id}/user`)
        .set(auth(board.token))
        .send({ email: person.email })
        .expect(200);

      const token = await login(ctx, person.email);
      const own = await ctx.http().get('/api/v1/me/athlete').set(auth(token)).expect(200);
      const me = await ctx.http().get('/api/v1/me').set(auth(token)).expect(200);

      expect(own.body.id).toBe(athlete.body.id);
      expect(me.body.roles).toContain('athlete');
      await ctx.http().get(`/api/v1/athletes/${athlete.body.id}`).set(auth(token)).expect(403);
      await ctx
        .http()
        .get('/api/v1/me/athlete')
        .set(auth(await login(ctx, other.email)))
        .expect(404);
    });
  });

  describe('seletivas e inscrições', () => {
    it('accepts registrations only while open and within slots', async () => {
      const draft = await ctx
        .http()
        .post('/api/v1/tryouts')
        .set(auth(board.token))
        .send({ title: `Rascunho ${Date.now()}` })
        .expect(201);

      await ctx.http().get(`/api/v1/public/tryouts/${draft.body.slug}`).expect(404);

      const tryout = await createOpenTryout(1);

      await ctx
        .http()
        .post(`/api/v1/public/tryouts/${tryout.slug}/registrations`)
        .send(applicant())
        .expect(201);
      const full = await ctx
        .http()
        .post(`/api/v1/public/tryouts/${tryout.slug}/registrations`)
        .send(applicant())
        .expect(409);

      expect(full.body.code).toBe('TRYOUT_FULL');
    });

    it('validates consent, guardian rules and duplicates on public registration', async () => {
      const tryout = await createOpenTryout();
      const url = `/api/v1/public/tryouts/${tryout.slug}/registrations`;
      const email = uniqueEmail('dup');

      await ctx
        .http()
        .post(url)
        .send(applicant({ privacyConsent: false }))
        .expect(422);
      await ctx.http().post(url).send(applicant(MINOR)).expect(422);
      await ctx
        .http()
        .post(url)
        .send(
          applicant({
            birthDate: '2016-01-01',
            guardianName: 'Mãe',
            guardianPhone: '68 90000-0000'
          })
        )
        .expect(422);
      await ctx
        .http()
        .post(url)
        .send(applicant({ ...MINOR, guardianName: 'Pai', guardianPhone: '68 90000-0001', email }))
        .expect(201);
      await ctx.http().post(url).send(applicant({ email })).expect(409);

      const row = await ctx.prisma.tryoutRegistration.findFirstOrThrow({ where: { email } });

      expect(row.consentAt).not.toBeNull();
      expect(row.privacyNoticeVersion).toBe('2026-10');
    });

    it('reviews, notifies the applicant and converts to athlete keeping the origin', async () => {
      const tryout = await createOpenTryout();
      const applicantUser = await createUser(ctx.prisma, ['user']);
      const applicantToken = await login(ctx, applicantUser.email);
      const registration = await ctx
        .http()
        .post(`/api/v1/public/tryouts/${tryout.slug}/registrations`)
        .set(auth(applicantToken))
        .send(applicant({ email: applicantUser.email, fullName: `Aprovada ${Date.now()}` }))
        .expect(201);
      const statusUrl = `/api/v1/tryout-registrations/${registration.body.id}/status`;

      await ctx
        .http()
        .put(statusUrl)
        .set(auth(board.token))
        .send({ status: 'REJECTED' })
        .expect(422);
      await ctx
        .http()
        .put(statusUrl)
        .set(auth(board.token))
        .send({ status: 'APPROVED' })
        .expect(200);
      await ctx
        .http()
        .put(statusUrl)
        .set(auth(board.token))
        .send({ status: 'APPROVED' })
        .expect(409);

      const notifications = await ctx
        .http()
        .get('/api/v1/me/notifications')
        .set(auth(applicantToken))
        .expect(200);

      expect(notifications.body.data[0].title).toBe('Inscrição aprovada!');

      const mine = await ctx
        .http()
        .get('/api/v1/me/tryout-registrations')
        .set(auth(applicantToken))
        .expect(200);

      expect(mine.body[0].status).toBe('APPROVED');

      const converted = await ctx
        .http()
        .post(`/api/v1/tryout-registrations/${registration.body.id}/convert`)
        .set(auth(board.token))
        .send({ fullName: registration.body.fullName, ...ADULT })
        .expect(201);
      const origin = await ctx.prisma.auditLog.findFirst({
        where: { entityId: converted.body.id, action: 'athlete.created' }
      });

      expect(origin?.afterData).toMatchObject({
        origin: { type: 'TryoutRegistration', id: registration.body.id }
      });
      await ctx
        .http()
        .post(`/api/v1/tryout-registrations/${registration.body.id}/convert`)
        .set(auth(board.token))
        .send({ fullName: `Outra ${Date.now()}` })
        .expect(409);
    });

    it('notifies applicants when a tryout is cancelled and requires a reason', async () => {
      const tryout = await createOpenTryout();
      const user = await createUser(ctx.prisma, ['user']);
      const token = await login(ctx, user.email);

      await ctx
        .http()
        .post(`/api/v1/public/tryouts/${tryout.slug}/registrations`)
        .set(auth(token))
        .send(applicant({ email: user.email }))
        .expect(201);
      await ctx
        .http()
        .put(`/api/v1/tryouts/${tryout.id}/status`)
        .set(auth(board.token))
        .send({ status: 'CANCELLED' })
        .expect(422);
      await ctx
        .http()
        .put(`/api/v1/tryouts/${tryout.id}/status`)
        .set(auth(board.token))
        .send({ status: 'CANCELLED', reason: 'Ginásio indisponível' })
        .expect(200);

      const count = await ctx
        .http()
        .get('/api/v1/me/notifications/unread-count')
        .set(auth(token))
        .expect(200);

      expect(count.body.count).toBe(1);
    });
  });

  describe('interessados', () => {
    it('registers interest publicly without creating access and converts once', async () => {
      const email = uniqueEmail('interesse');
      const created = await ctx
        .http()
        .post('/api/v1/public/interest')
        .send({ ...applicant({ email }), notes: 'Jogo há 3 anos' })
        .expect(201);

      expect(await ctx.prisma.user.count({ where: { email } })).toBe(0);

      await ctx
        .http()
        .put(`/api/v1/interested-people/${created.body.id}/status`)
        .set(auth(board.token))
        .send({ status: 'CONVERTED' })
        .expect(409);

      const athlete = await ctx
        .http()
        .post(`/api/v1/interested-people/${created.body.id}/convert`)
        .set(auth(board.token))
        .send({ fullName: `Interessada ${Date.now()}`, ...ADULT, email })
        .expect(201);

      expect(athlete.body.email).toBe(email);
      await ctx
        .http()
        .post(`/api/v1/interested-people/${created.body.id}/convert`)
        .set(auth(board.token))
        .send({ fullName: `Repetida ${Date.now()}` })
        .expect(409);
    });

    it('denies recruitment data to common users', async () => {
      const user = await tokenFor(ctx, ['user']);

      await ctx.http().get('/api/v1/interested-people').set(auth(user.token)).expect(403);
      await ctx.http().get('/api/v1/athletes').set(auth(user.token)).expect(403);
      await ctx.http().get('/api/v1/athletes').expect(401);
    });
  });

  it('exposes dashboard indicators with definitions', async () => {
    const summary = await ctx
      .http()
      .get('/api/v1/dashboard/summary')
      .set(auth(board.token))
      .expect(200);

    expect(summary.body.map((i: { key: string }) => i.key)).toEqual(
      expect.arrayContaining(['activeAthletes', 'newRegistrations', 'openTryouts'])
    );
    expect(summary.body[0].definition).toEqual(expect.any(String));
  });
});
