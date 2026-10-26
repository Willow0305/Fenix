import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client';

/** Endereço para o driver `pg`: sem os parâmetros próprios do Prisma (`schema`, limites). */
export function driverUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get('sslmode');

  url.search = sslmode ? `?sslmode=${sslmode}` : '';

  return url.toString();
}

/**
 * Adaptador do PostgreSQL exigido pelo Prisma 7 (DT-054). Mantém o tempo máximo de 5 s
 * para conectar, padrão do Prisma 6 (o `pg` esperaria para sempre).
 */
export function prismaAdapter(databaseUrl = process.env['DATABASE_URL']): PrismaPg {
  if (!databaseUrl && process.env['NODE_ENV'] === 'production') {
    throw new Error('Variável de ambiente obrigatória ausente: DATABASE_URL.');
  }

  // Fora de produção, sem banco configurado, a aplicação sobe e só a consulta falha (como
  // no Prisma 6); testes de unidade que montam a aplicação dependem disso.
  const url = databaseUrl ?? 'postgresql://sem-banco@127.0.0.1:1/sem_banco_configurado';

  return new PrismaPg({ connectionString: driverUrl(url), connectionTimeoutMillis: 5_000 });
}

/** Cliente avulso (comandos de linha e testes); a aplicação usa o `PrismaService`. */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({ adapter: prismaAdapter(databaseUrl) });
}

/** Cliente Prisma compartilhado. A conexão é aberta sob demanda na primeira consulta. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: prismaAdapter() });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
