'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '../../../components/icon';
import { Alert, Empty, Loading, PageHeader, Pagination } from '../../../components/ui';
import type { Page } from '../../../lib/api-types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { ORDER_STATUS, type Order, type OrderStatus } from '../../../lib/store-types';
import { useResource } from '../../../lib/use-resource';

export default function OrdersAdminPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const orders = useResource<Page<Order>>('/store/orders', {
    page,
    pageSize: 25,
    status,
    search: term
  });

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Pedidos da loja. Comprovantes PIX aparecem como pagamento aguardando confirmação."
      />
      <form
        className="row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setTerm(search);
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, nome ou e-mail"
          />
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as OrderStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(ORDER_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>
      {orders.error ? <Alert kind="error">{orders.error}</Alert> : null}
      {orders.loading && !orders.data ? <Loading /> : null}
      {orders.data?.data.length === 0 ? <Empty>Nenhum pedido.</Empty> : null}
      {orders.data && orders.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Pedido</th>
                <th scope="col">Cliente</th>
                <th scope="col">Data</th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.data.map((order) => (
                <tr key={order.id}>
                  <td data-label="Pedido">
                    <Link href={`/admin/pedidos/${order.id}`}>{order.orderNumber}</Link>
                    {order.fulfillment === 'DELIVERY' ? (
                      <span className="badge badge-info" title="Entrega em casa">
                        <Icon name="truck" /> entrega
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Cliente">
                    {order.customerName}
                    {order.isGuest ? (
                      <span className="badge" style={{ marginLeft: 4 }}>
                        visitante
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Data">{formatDateTime(order.createdAt)}</td>
                  <td data-label="Total" className="num">
                    {formatMoney(order.totalAmount.amount)}
                  </td>
                  <td data-label="Situação">
                    <span className={`badge ${ORDER_STATUS[order.status].badge}`}>
                      {ORDER_STATUS[order.status].label}
                    </span>
                    {order.pendingAmount.amount !== '0.00' ? (
                      <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                        comprovante
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {orders.data ? <Pagination {...orders.data.meta} onChange={setPage} /> : null}
    </>
  );
}
