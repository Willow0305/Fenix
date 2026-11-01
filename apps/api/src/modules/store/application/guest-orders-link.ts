import type { AuditService } from '../../../common/audit/audit.service';
import type { RequestMeta } from '../../../common/http/request-context';
import type { PrismaService, PrismaTx } from '../../../common/prisma/prisma.service';

/**
 * Pedidos feitos sem conta com o mesmo e-mail passam para a conta que confirmou esse e-mail
 * (DT-096). Só com e-mail confirmado: sem isso, qualquer um criaria conta com o e-mail de
 * outra pessoa para ver os pedidos dela. Os avisos da fila sem conta param sozinhos.
 */
export async function linkGuestOrdersByEmail(
  client: PrismaService | PrismaTx,
  audit: AuditService,
  user: { id: string; email: string },
  meta?: RequestMeta
): Promise<number> {
  const orders = await client.order.findMany({
    where: {
      customerUserId: null,
      customerEmail: { equals: user.email, mode: 'insensitive' }
    },
    select: { id: true }
  });

  if (orders.length === 0) {
    return 0;
  }

  const linked = await client.order.updateMany({
    where: { id: { in: orders.map((order) => order.id) }, customerUserId: null },
    data: { customerUserId: user.id }
  });

  for (const order of orders) {
    await audit.record(
      {
        actorUserId: user.id,
        action: 'order.linked_to_account',
        entityType: 'Order',
        entityId: order.id,
        after: { via: 'email-confirmado' },
        ...(meta ? { meta } : {})
      },
      client as PrismaTx
    );
  }

  return linked.count;
}
