import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { syncAccessCatalog } from './roles.service';

/**
 * Ao subir a API, grava no banco as permissões novas do catálogo e as dá aos papéis de
 * sistema (DT-073). Sem isso, uma permissão criada numa versão nova só valia depois de
 * `npm run db:seed`, e a diretoria recebia "sem permissão" em telas novas. Idempotente:
 * respeita permissões removidas à mão (só concede as que o banco ainda não conhecia).
 */
@Injectable()
export class AccessCatalogSync implements OnApplicationBootstrap {
  private readonly logger = new Logger('Permissões');

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => syncAccessCatalog(tx));
    } catch (error) {
      // Outra instância sincronizando ao mesmo tempo não impede a API de subir.
      this.logger.warn(
        `Catálogo de permissões não sincronizado agora: ${error instanceof Error ? error.name : 'erro'}.`
      );
    }
  }
}
