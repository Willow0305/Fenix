'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { formatDateTime } from '../lib/format';
import type { Order } from '../lib/store-types';
import { Icon } from './icon';
import { Alert, ErrorSummary, TextArea, useSubmit } from './ui';

/**
 * Entrega em casa para o comprador (DT-075): código de 4 dígitos e quem está levando enquanto
 * o pedido está a caminho; "Não recebi" quando a entrega foi só marcada, em até 3 dias.
 */
export function DeliveryTracking({
  order,
  notReceived,
  onChanged
}: {
  readonly order: Order;
  /** Rota e campos extras (visitante: número e código do pedido). */
  readonly notReceived: { endpoint: string; extra?: Record<string, string> };
  readonly onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const report = useSubmit(async () => {
    await api(notReceived.endpoint, {
      method: 'POST',
      body: { ...(notReceived.extra ?? {}), note }
    });
    setOpen(false);
    await onChanged();
  });

  if (order.fulfillment !== 'DELIVERY') {
    return null;
  }

  const courier = order.courier
    ? [order.courier.firstName, order.courier.vehicle, order.courier.plate]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <>
      {order.status === 'OUT_FOR_DELIVERY' ? (
        <section className="card stack delivery-code" aria-labelledby="codigo-entrega">
          <h2 id="codigo-entrega" className="m-0">
            <Icon name="truck" /> Seu pedido está a caminho
          </h2>
          {courier ? <p className="m-0">Quem está levando: {courier}</p> : null}
          {order.deliveryCode ? (
            <>
              <p className="m-0">Ao receber, diga este código ao entregador:</p>
              <p
                className="delivery-code-value"
                aria-label={`Código ${order.deliveryCode.split('').join(' ')}`}
              >
                {order.deliveryCode}
              </p>
              <small className="muted">
                Só diga o código quando o pedido estiver na sua mão. Ele comprova a entrega.
              </small>
            </>
          ) : null}
        </section>
      ) : null}

      {order.notReceivedAt ? (
        <Alert kind={order.notReceivedResolution ? 'info' : 'warning'}>
          {order.notReceivedResolution === 'REDELIVER'
            ? 'Combinamos uma nova entrega do seu pedido.'
            : order.notReceivedResolution === 'REFUND'
              ? 'Seu pedido foi estornado.'
              : order.notReceivedResolution === 'KEEP'
                ? 'A diretoria respondeu seu aviso; confira as notificações.'
                : `Você avisou que não recebeu em ${formatDateTime(order.notReceivedAt)}. A diretoria vai entrar em contato.`}
        </Alert>
      ) : null}

      {order.notReceivedUntil ? (
        <section className="card stack" aria-labelledby="nao-recebi">
          <h2 id="nao-recebi" className="m-0">
            Recebeu o pedido?
          </h2>
          <p className="m-0">
            Se o pedido não chegou, avise até {formatDateTime(order.notReceivedUntil)}. Depois disso
            a entrega fica confirmada.
          </p>
          {open ? (
            <form className="form" onSubmit={(event) => void report.submit(event)}>
              <ErrorSummary error={report.error} />
              <TextArea
                label="O que aconteceu?"
                required
                minLength={10}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: estive em casa o dia todo e ninguém entregou."
              />
              <div className="form-actions">
                <button type="submit" className="btn btn-danger" disabled={report.pending}>
                  Avisar que não recebi
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
                Não recebi
              </button>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
