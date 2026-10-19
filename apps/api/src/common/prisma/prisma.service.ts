import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Cliente Prisma compartilhado. A conexão é aberta sob demanda na primeira consulta. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
