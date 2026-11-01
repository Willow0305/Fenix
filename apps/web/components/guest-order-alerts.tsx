'use client';

import { api } from '../lib/api-client';
import type { GuestOrderRef } from '../lib/guest-orders';
import type { Order } from '../lib/store-types';
import { Icon } from './icon';
import { ErrorSummary, useSubmit } from './ui';

/**
 * Avisos do pedido de quem comprou sem conta (DT-096): por e-mail sempre e, se a pessoa
 * quiser, por WhatsApp; liga e desliga aqui mesmo (consentimento revogável, DT-048).
 */
export function GuestOrderAlerts({
  order,
  access,
  onChanged
}: {
  readonly order: Order;
  readonly access: GuestOrderRef;
  readonly onChanged: (updated: Order) => void;
}) {
  const enabled = order.guestWhatsappOptIn === true;
  const toggle = useSubmit(async () => {
    onChanged(
      await api<Order>('/public/orders/whatsapp', {
        method: 'POST',
        body: { ...access, enabled: !enabled },
        auth: false
      })
    );
  });

  return (
    <section className="card stack gap-sm" aria-labelledby="avisos-pedido">
      <h2 id="avisos-pedido" className="m-0 h-small">
        <Icon name="bell" /> Avisos deste pedido
      </h2>
      <p className="m-0">
        Mandamos cada novidade (pagamento, pronto para retirar, saiu para entrega, entregue) para{' '}
        <strong>{order.customerEmail ?? 'o e-mail da compra'}</strong>, com o link do pedido. Não
        chegou? Olhe a caixa de spam ou lixo eletrônico.
      </p>
      <ErrorSummary error={toggle.error} />
      {order.customerPhone ? (
        <div className="row">
          <span className="flex-14">
            WhatsApp: <strong>{enabled ? 'ligado' : 'desligado'}</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={toggle.pending}
            onClick={() => void toggle.submit()}
          >
            {enabled ? 'Parar avisos por WhatsApp' : 'Receber também por WhatsApp'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
