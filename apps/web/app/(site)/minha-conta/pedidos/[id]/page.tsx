'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { OrderPayment } from '../../../../../components/payment-instructions';
import { OrderRightsPanel } from '../../../../../components/order-rights';
import { OrderSummary } from '../../../../../components/order-summary';
import { Alert, Loading } from '../../../../../components/ui';
import type { Order } from '../../../../../lib/store-types';
import { useResource } from '../../../../../lib/use-resource';

export default function MyOrderPage() {
  const { id } = useParams<{ id: string }>();
  const order = useResource<Order>(`/me/orders/${id}`);

  if (!order.data) {
    return order.error ? <Alert kind="error">{order.error}</Alert> : <Loading />;
  }

  return (
    <>
      <Link href="/minha-conta/pedidos">← Meus pedidos</Link>
      <OrderSummary order={order.data} />
      {order.data.status === 'READY_FOR_PICKUP' ? (
        <Alert kind="success">Seu pedido está pronto para retirada!</Alert>
      ) : null}
      {order.data.status === 'OUT_FOR_DELIVERY' ? (
        <Alert kind="info">Seu pedido saiu para entrega no endereço informado.</Alert>
      ) : null}
      <OrderPayment order={order.data} endpoint={`/me/orders/${id}/proof`} onDone={order.setData} />
      <OrderRightsPanel target={{ kind: 'user', orderId: id }} />
    </>
  );
}
