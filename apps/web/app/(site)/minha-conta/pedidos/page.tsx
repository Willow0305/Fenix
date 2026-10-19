'use client';

import Link from 'next/link';

import { Alert, Empty, Loading, PageHeader } from '../../../../components/ui';
import { formatDateTime, formatMoney } from '../../../../lib/format';
import { ORDER_STATUS, type Order } from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';

export default function MyOrdersPage() {
  const orders = useResource<Order[]>('/me/orders');

  return (
    <>
      <PageHeader title="Meus pedidos" />
      {orders.error ? <Alert kind="error">{orders.error}</Alert> : null}
      {orders.loading && !orders.data ? <Loading /> : null}
      {orders.data?.length === 0 ? (
        <Empty>
          Você ainda não fez pedidos. <Link href="/loja">Ir para a loja</Link>
        </Empty>
      ) : null}
      {orders.data?.map((order) => (
        <Link
          key={order.id}
          href={`/minha-conta/pedidos/${order.id}`}
          className="card row"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          <strong>{order.orderNumber}</strong>
          <span className="muted">{formatDateTime(order.createdAt)}</span>
          <span className="spacer" />
          <span>{formatMoney(order.totalAmount.amount)}</span>
          <span className={`badge ${ORDER_STATUS[order.status].badge}`}>
            {ORDER_STATUS[order.status].label}
          </span>
        </Link>
      ))}
    </>
  );
}
