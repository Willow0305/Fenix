'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { todayCivil } from '../lib/format';
import { useIdempotencyKey } from '../lib/idempotency';
import type { Order } from '../lib/store-types';
import { PixPayment } from './pix-payment';
import { Alert, ErrorSummary, TextField, useSubmit } from './ui';

/**
 * Instruções de PIX e envio de comprovante de um pedido aguardando pagamento.
 * `endpoint` recebe multipart; visitantes enviam também número e código.
 */
export function OrderPayment({
  order,
  endpoint,
  extraFields = {},
  onDone
}: {
  readonly order: Order;
  readonly endpoint: string;
  readonly extraFields?: Record<string, string>;
  readonly onDone: (order: Order) => void;
}) {
  const idem = useIdempotencyKey();
  const [paidOn, setPaidOn] = useState(todayCivil());
  const [file, setFile] = useState<File | null>(null);
  const action = useSubmit(async () => {
    const form = new FormData();

    form.set('paidOn', paidOn);

    for (const [key, value] of Object.entries(extraFields)) {
      form.set(key, value);
    }

    if (file) {
      form.set('file', file);
    }

    const updated = await api<Order>(endpoint, {
      method: 'POST',
      headers: idem.headers(),
      body: form
    });

    idem.rotate();
    onDone(updated);
  });

  if (order.status === 'PAID') {
    return <Alert kind="success">Pagamento confirmado. Obrigado!</Alert>;
  }

  if (order.status !== 'AWAITING_PAYMENT') {
    return null;
  }

  if (order.pendingAmount.amount !== '0.00') {
    return (
      <Alert kind="info">
        Comprovante recebido. A diretoria vai conferir e confirmar o pagamento.
      </Alert>
    );
  }

  const guest =
    extraFields['orderNumber'] && extraFields['code']
      ? { orderNumber: extraFields['orderNumber'], code: extraFields['code'] }
      : null;

  // PIX automático confirmado: busca o pedido atualizado (pago) e devolve à tela (DT-071).
  async function refreshPaid() {
    onDone(
      guest
        ? await api<Order>('/public/orders/lookup', { method: 'POST', body: guest, auth: false })
        : await api<Order>(`/me/orders/${order.id}`)
    );
  }

  return (
    <>
      <PixPayment
        target={guest ? { kind: 'guest', ...guest } : { kind: 'order', orderId: order.id }}
        onPaid={() => void refreshPaid()}
      />
      <section className="card stack" aria-labelledby="pagar">
        <h2 id="pagar">Pagamento com comprovante</h2>
        {order.paymentInfo?.pixKey ? (
          <p>
            Faça um PIX de <strong>R$ {order.totalAmount.amount.replace('.', ',')}</strong> para a
            chave <code>{order.paymentInfo.pixKey}</code> e envie o comprovante abaixo.
          </p>
        ) : (
          <p>Combine o pagamento com a diretoria e envie o comprovante abaixo.</p>
        )}
        {order.paymentInfo?.bankingDetails ? (
          <p className="prose muted">{order.paymentInfo.bankingDetails}</p>
        ) : null}
        {order.reservationExpiresAt ? (
          <small className="muted">
            Os itens ficam reservados até{' '}
            {new Date(order.reservationExpiresAt).toLocaleString('pt-BR')}.
          </small>
        ) : null}
        <form className="form" onSubmit={(event) => void action.submit(event)}>
          <ErrorSummary error={action.error} />
          <div className="form-grid">
            <TextField
              label="Data do pagamento"
              type="date"
              required
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
            <div className="field">
              <label htmlFor={`proof-${order.id}`}>Comprovante (imagem ou PDF)</label>
              <input
                id={`proof-${order.id}`}
                type="file"
                required
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!file || action.pending}>
              {action.pending ? 'Enviando…' : 'Enviar comprovante'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
