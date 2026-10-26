import { randomUUID } from 'node:crypto';

import { PostgresThrottlerStorage } from '../src/common/http/postgres-throttler-storage';
import { JobScheduler } from '../src/common/jobs/job-scheduler';
import { PrismaService } from '../src/common/prisma/prisma.service';

/** Dois servidores simulados: instâncias separadas sobre o mesmo banco (DT-047). */
describe('Escala com mais de um servidor', () => {
  const prisma = new PrismaService();
  const serverA = new JobScheduler(prisma);
  const serverB = new JobScheduler(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('tarefas automáticas', () => {
    it('rodam em um só servidor por intervalo, mesmo disparadas juntas', async () => {
      const name = `teste.${randomUUID()}`;
      let runs = 0;
      const task = async () => {
        runs += 1;
      };

      const results = await Promise.all([
        serverA.runExclusive(name, 60_000, task),
        serverB.runExclusive(name, 60_000, task),
        serverA.runExclusive(name, 60_000, task)
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(runs).toBe(1);

      const lease = await prisma.scheduledJobLease.findUniqueOrThrow({ where: { name } });

      expect(lease.lastStatus).toBe('SUCCEEDED');
      expect(lease.lastFinishedAt).not.toBeNull();
    });

    it('outro servidor assume quando a concessão vence', async () => {
      const name = `teste.${randomUUID()}`;
      const task = async () => undefined;

      expect(await serverA.runExclusive(name, 60_000, task)).toBe(true);
      expect(await serverB.runExclusive(name, 60_000, task)).toBe(false);

      await prisma.scheduledJobLease.update({
        where: { name },
        data: { lockedUntil: new Date(Date.now() - 1_000) }
      });

      expect(await serverB.runExclusive(name, 60_000, task)).toBe(true);
      expect((await prisma.scheduledJobLease.findUniqueOrThrow({ where: { name } })).holder).toBe(
        serverB.holder
      );
    });

    it('registra a falha só com o tipo do erro, sem a mensagem', async () => {
      const name = `teste.${randomUUID()}`;

      expect(
        await serverA.runExclusive(name, 60_000, async () => {
          throw new TypeError('dado pessoal que não pode ir para o banco');
        })
      ).toBe(true);

      const lease = await prisma.scheduledJobLease.findUniqueOrThrow({ where: { name } });

      expect(lease.lastStatus).toBe('FAILED');
      expect(lease.lastError).toBe('TypeError');
    });
  });

  describe('limite de requisições', () => {
    const storageA = new PostgresThrottlerStorage(prisma, serverA);
    const storageB = new PostgresThrottlerStorage(prisma, serverB);

    it('soma as tentativas dos dois servidores e bloqueia ao passar do limite', async () => {
      const key = randomUUID();
      const hit = (storage: PostgresThrottlerStorage) =>
        storage.increment(key, 60_000, 3, 120_000, 'default');

      expect(await hit(storageA)).toMatchObject({ totalHits: 1, isBlocked: false });
      expect(await hit(storageB)).toMatchObject({ totalHits: 2, isBlocked: false });
      expect(await hit(storageA)).toMatchObject({ totalHits: 3, isBlocked: false });

      const blocked = await hit(storageB);

      expect(blocked).toMatchObject({ totalHits: 4, isBlocked: true });
      expect(blocked.timeToBlockExpire).toBeGreaterThan(110);
      expect(blocked.timeToExpire).toBeLessThanOrEqual(60);

      // Durante o bloqueio as tentativas não somam.
      expect(await hit(storageA)).toMatchObject({ totalHits: 4, isBlocked: true });
    });

    it('conta certo com requisições simultâneas', async () => {
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          (i % 2 ? storageA : storageB).increment(key, 60_000, 10, 60_000, 'default')
        )
      );

      expect(results.filter((r) => !r.isBlocked)).toHaveLength(10);
      expect(results.filter((r) => r.isBlocked)).toHaveLength(2);
    });

    it('recomeça a contagem quando a janela ou o bloqueio vencem', async () => {
      const windowKey = randomUUID();
      const blockKey = randomUUID();

      await storageA.increment(windowKey, 60_000, 5, 60_000, 'default');
      await storageA.increment(windowKey, 60_000, 5, 60_000, 'default');
      await prisma.rateLimitBucket.update({
        where: { key: `default:${windowKey}` },
        data: { windowEndsAt: new Date(Date.now() - 1_000) }
      });

      expect(await storageB.increment(windowKey, 60_000, 5, 60_000, 'default')).toMatchObject({
        totalHits: 1,
        isBlocked: false
      });

      await storageA.increment(blockKey, 60_000, 1, 60_000, 'default');
      expect(await storageA.increment(blockKey, 60_000, 1, 60_000, 'default')).toMatchObject({
        isBlocked: true
      });
      await prisma.rateLimitBucket.update({
        where: { key: `default:${blockKey}` },
        data: { blockedUntil: new Date(Date.now() - 1_000) }
      });

      expect(await storageB.increment(blockKey, 60_000, 1, 60_000, 'default')).toMatchObject({
        totalHits: 1,
        isBlocked: false,
        timeToBlockExpire: 0
      });
    });

    it('limites com nomes diferentes não se misturam', async () => {
      const key = randomUUID();

      await storageA.increment(key, 60_000, 1, 60_000, 'default');

      expect(await storageA.increment(key, 60_000, 1, 60_000, 'strict')).toMatchObject({
        totalHits: 1,
        isBlocked: false
      });
    });

    it('a limpeza apaga só contagens vencidas e sem bloqueio', async () => {
      const expired = randomUUID();
      const blocked = randomUUID();
      const active = randomUUID();
      const past = new Date(Date.now() - 1_000);

      await storageA.increment(expired, 60_000, 5, 60_000, 'default');
      await storageA.increment(blocked, 60_000, 5, 60_000, 'default');
      await storageA.increment(active, 60_000, 5, 60_000, 'default');
      await prisma.rateLimitBucket.update({
        where: { key: `default:${expired}` },
        data: { windowEndsAt: past }
      });
      await prisma.rateLimitBucket.update({
        where: { key: `default:${blocked}` },
        data: { windowEndsAt: past, blockedUntil: new Date(Date.now() + 60_000) }
      });

      await storageA.cleanup();

      const keys = (await prisma.rateLimitBucket.findMany({ select: { key: true } })).map(
        (row) => row.key
      );

      expect(keys).not.toContain(`default:${expired}`);
      expect(keys).toContain(`default:${blocked}`);
      expect(keys).toContain(`default:${active}`);
    });
  });
});
