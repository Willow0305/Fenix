import { Injectable, Logger } from '@nestjs/common';

import { NotificationsService } from './notifications.service';

export interface StaffAlert {
  /** Tipo com prefixo `staff.` (finalidade "Tarefas da diretoria", DT-061). */
  readonly type: `staff.${string}`;
  readonly title: string;
  readonly message: string;
  readonly link: string;
  /** Mesma chave nunca avisa duas vezes a mesma pessoa. */
  readonly key: string;
}

/**
 * Avisos de trabalho para a diretoria (DT-061): pedido novo, comprovante enviado,
 * interessado e inscrição. Vão para quem tem a permissão do módulo; aparecem no sino e no
 * aviso flutuante. Chamado depois da operação: falhar aqui nunca desfaz o que foi feito.
 */
@Injectable()
export class StaffAlertsService {
  private readonly logger = new Logger('AvisosDiretoria');

  constructor(private readonly notifications: NotificationsService) {}

  async alert(permission: string, alert: StaffAlert): Promise<void> {
    try {
      const holders = await this.notifications.permissionHolders(permission, undefined, 200);

      await this.notifications.notify(
        holders.map((userId) => ({
          userId,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          link: alert.link,
          deduplicationKey: alert.key
        }))
      );
    } catch (error) {
      this.logger.warn(`Aviso à diretoria não enviado: ${(error as Error).name}.`);
    }
  }
}
