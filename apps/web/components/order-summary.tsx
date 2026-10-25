import { PAYMENT_STATUS } from '../lib/finance-types';
import { formatDateTime, formatMoney } from '../lib/format';
import { ORDER_STATUS, type Order } from '../lib/store-types';

/** Resumo de pedido para cliente e diretoria (itens congelados no momento da compra). */
export function OrderSummary({ order }: { readonly order: Order }) {
  return (
    <section className="card stack" aria-label={`Pedido ${order.orderNumber}`}>
      <div className="row">
        <h2 style={{ margin: 0 }}>{order.orderNumber}</h2>
        <span className={`badge ${ORDER_STATUS[order.status].badge}`}>
          {ORDER_STATUS[order.status].label}
        </span>
        <span className="spacer" />
        <span className="muted">{formatDateTime(order.createdAt)}</span>
      </div>
      <div className="table-wrap">
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className="num">
                Qtd.
              </th>
              <th scope="col" className="num">
                Unitário
              </th>
              <th scope="col" className="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td data-label="Item">
                  {item.productName}
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {item.variantName} · {item.sku}
                    {item.campaign ? ` · remessa ${item.campaign.name}` : ''}
                    {item.pickedUpAt ? ` · retirado em ${formatDateTime(item.pickedUpAt)}` : ''}
                  </div>
                </td>
                <td data-label="Qtd." className="num">
                  {item.quantity}
                </td>
                <td data-label="Unitário" className="num">
                  {formatMoney(item.unitPrice.amount)}
                </td>
                <td data-label="Total" className="num">
                  {formatMoney(item.totalAmount.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="num">
                Total
              </th>
              <td className="num">
                <strong>{formatMoney(order.totalAmount.amount)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {order.payments.length > 0 ? (
        <ul style={{ margin: 0 }}>
          {order.payments.map((payment) => (
            <li key={payment.id}>
              {formatMoney(payment.amount.amount)} · {payment.method.name} ·{' '}
              <span className={`badge ${PAYMENT_STATUS[payment.status].badge}`}>
                {PAYMENT_STATUS[payment.status].label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {order.cancellationReason ? (
        <p className="muted">Motivo do cancelamento: {order.cancellationReason}</p>
      ) : null}
    </section>
  );
}
