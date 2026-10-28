'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import type { Order } from '../lib/store-types';
import { ConfirmDialog } from './ui';

/**
 * "Cancelar pedido" do comprador (DT-076): só enquanto aguarda pagamento e sem comprovante em
 * análise. Pedido pago segue a desistência em 7 dias.
 */
export function CancelOrder({
  order,
  guest,
  onDone
}: {
  readonly order: Order;
  /** Visitante: número e código do pedido. */
  readonly guest?: { orderNumber: string; code: string };
  readonly onDone: (order: Order) => void;
}) {
  const [open, setOpen] = useState(false);

  if (order.status !== 'AWAITING_PAYMENT' || order.pendingAmount.amount !== '0.00') {
    return null;
  }

  return (
    <>
      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          Cancelar pedido
        </button>
      </div>
      <ConfirmDialog
        open={open}
        title={`Cancelar o pedido ${order.orderNumber}`}
        description="Os itens voltam para a loja. Se ainda quiser, é só fazer um pedido novo."
        confirmLabel="Cancelar pedido"
        danger
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          onDone(
            guest
              ? await api<Order>('/public/orders/cancel', {
                  method: 'POST',
                  body: guest,
                  auth: false
                })
              : await api<Order>(`/me/orders/${order.id}/cancel`, { method: 'POST' })
          );
        }}
      />
    </>
  );
}
