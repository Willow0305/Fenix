'use client';

import { useState } from 'react';

import { OrderPayment } from '../../../../components/payment-instructions';
import { OrderSummary } from '../../../../components/order-summary';
import { ErrorSummary, PageHeader, TextField, useSubmit } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Order } from '../../../../lib/store-types';

/** Consulta segura de pedido de visitante (número + código), sem expor o código na URL. */
export default function GuestOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const lookup = useSubmit(async () => {
    setOrder(
      await api<Order>('/public/orders/lookup', {
        method: 'POST',
        body: { orderNumber: orderNumber.trim(), code: code.trim() },
        auth: false
      })
    );
  });

  return (
    <div className="container stack" style={{ paddingTop: '2rem', maxWidth: 860 }}>
      <PageHeader
        title="Consultar pedido"
        description="Informe o número do pedido e o código de acesso enviados por e-mail."
      />
      <form className="form card" onSubmit={(event) => void lookup.submit(event)}>
        <ErrorSummary error={lookup.error} />
        <div className="form-grid">
          <TextField
            label="Número do pedido"
            required
            placeholder="FNX-261018-ABCDEF"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
          <TextField
            label="Código de acesso"
            required
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={lookup.pending}>
            Consultar
          </button>
        </div>
      </form>
      {order ? (
        <>
          <OrderSummary order={order} />
          <OrderPayment
            order={order}
            endpoint="/public/orders/proof"
            extraFields={{ orderNumber: order.orderNumber, code: code.trim() }}
            onDone={setOrder}
          />
        </>
      ) : null}
    </div>
  );
}
