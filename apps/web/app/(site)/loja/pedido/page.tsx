'use client';

import { useEffect, useRef, useState } from 'react';

import { OrderPayment } from '../../../../components/payment-instructions';
import { OrderRightsPanel } from '../../../../components/order-rights';
import { CancelOrder } from '../../../../components/cancel-order';
import { GuestOrderAlerts } from '../../../../components/guest-order-alerts';
import { DeliveryTracking } from '../../../../components/delivery-tracking';
import { OrderSummary } from '../../../../components/order-summary';
import { ErrorSummary, PageHeader, TextField, useSubmit } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import {
  forgetGuestOrder,
  type GuestOrderRef,
  parseGuestOrderHash,
  REMEMBER_DAYS,
  rememberedGuestOrders,
  rememberGuestOrder
} from '../../../../lib/guest-orders';
import type { Order } from '../../../../lib/store-types';

/**
 * Consulta de pedido de quem compra sem conta (número + código). O link fixo do e-mail e do
 * WhatsApp abre direto (`#pedido=...&codigo=...`), e o pedido pode ficar lembrado neste
 * aparelho (DT-096).
 */
export default function GuestOrderPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState<GuestOrderRef[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  // Consulta em andamento: a busca usa estes valores mesmo antes de o estado atualizar.
  const target = useRef<GuestOrderRef>({ orderNumber: '', code: '' });
  const lookup = useSubmit(async () => {
    const ref = {
      orderNumber: target.current.orderNumber.trim(),
      code: target.current.code.trim()
    };
    const found = await api<Order>('/public/orders/lookup', {
      method: 'POST',
      body: ref,
      auth: false
    });

    setOrder(found);

    if (remember) {
      rememberGuestOrder({ orderNumber: found.orderNumber, code: ref.code });
    } else {
      forgetGuestOrder(found.orderNumber);
    }

    setSaved(rememberedGuestOrders());
  });

  function open(ref: GuestOrderRef) {
    setOrderNumber(ref.orderNumber);
    setCode(ref.code);
    target.current = ref;
    void lookup.submit();
  }

  useEffect(() => {
    setSaved(rememberedGuestOrders());

    const fromLink = parseGuestOrderHash(window.location.hash);

    if (fromLink) {
      open(fromLink);
    }
    // Só ao abrir a página: o link fixo consulta sozinho.
  }, []);

  const current = { orderNumber: order?.orderNumber ?? '', code: target.current.code.trim() };

  return (
    <div className="container stack pt-lg" style={{ maxWidth: 860 }}>
      <PageHeader
        title="Consultar pedido"
        description="Abra pelo link enviado por e-mail ou WhatsApp, ou informe o número do pedido e o código de acesso."
      />
      {saved.length > 0 ? (
        <section className="card stack" aria-labelledby="pedidos-aparelho">
          <h2 id="pedidos-aparelho" className="m-0 h-small">
            Pedidos lembrados neste aparelho
          </h2>
          <ul className="list-plain stack gap-xs">
            {saved.map((ref) => (
              <li key={ref.orderNumber} className="row">
                <span className="flex-12">{ref.orderNumber}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => open(ref)}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    forgetGuestOrder(ref.orderNumber);
                    setSaved(rememberedGuestOrders());
                  }}
                >
                  Esquecer
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form
        className="form card"
        onSubmit={(event) => {
          target.current = { orderNumber, code };
          void lookup.submit(event);
        }}
      >
        <ErrorSummary error={lookup.error} />
        <div className="form-grid">
          <TextField
            label="Número do pedido"
            maxLength={40}
            required
            placeholder="FNX-261018-ABCDEF"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
          <TextField
            label="Código de acesso"
            maxLength={64}
            required
            autoComplete="off"
            placeholder="K7QH-3MXP"
            hint="Pode digitar com ou sem o traço, em letras maiúsculas ou minúsculas."
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span>
            Lembrar este pedido neste aparelho por {REMEMBER_DAYS} dias. Não marque em computador
            compartilhado.
          </span>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={lookup.pending}>
            {lookup.pending ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
      </form>
      {order ? (
        <>
          <OrderSummary order={order} />
          <GuestOrderAlerts order={order} access={current} onChanged={setOrder} />
          <DeliveryTracking
            order={order}
            notReceived={{ endpoint: '/public/orders/not-received', extra: current }}
            onChanged={() => lookup.submit()}
          />
          <OrderPayment
            order={order}
            endpoint="/public/orders/proof"
            extraFields={current}
            onDone={setOrder}
          />
          <CancelOrder order={order} guest={current} onDone={setOrder} />
          <OrderRightsPanel target={{ kind: 'guest', ...current }} />
        </>
      ) : null}
    </div>
  );
}
