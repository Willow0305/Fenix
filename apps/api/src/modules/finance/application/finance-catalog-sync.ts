import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { syncFinanceCatalog } from './finance-setup.service';

/**
 * Ao subir a API, cria as categorias e métodos de sistema que faltarem (ex.: "Entregas",
 * DT-075), como a sincronização de permissões (DT-073). Nada existente é alterado.
 */
@Injectable()
export class FinanceCatalogSync implements OnApplicationBootstrap {
  private readonly logger = new Logger('Caixa');

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => syncFinanceCatalog(tx));
    } catch (error) {
      this.logger.warn(
        `Plano financeiro não sincronizado agora: ${error instanceof Error ? error.name : 'erro'}.`
      );
    }
  }
}
