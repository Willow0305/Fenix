'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { formatDateTime } from '../lib/format';
import type { Order } from '../lib/store-types';
import { Alert, ErrorSummary, useSubmit } from './ui';

/**
 * Entrega comprovada no painel (DT-070): foto da entrega (item entregue ou documento
 * assinado) ou o "Recebi" do comprador. Sem nenhum dos dois, os prazos ainda não começaram.
 */
export function DeliveryProof({
  order,
  onChanged
}: {
  readonly order: Order;
  readonly onChanged: () => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const upload = useSubmit(async () => {
    if (!file) {
      return;
    }

    const body = new FormData();

    body.set('file', file);
    await api(`/store/orders/${order.id}/delivery-proof`, { method: 'POST', body });
    setFile(null);
    await onChanged();
  });

  if (order.status !== 'DELIVERED') {
    return null;
  }

  return (
    <section className="card stack" aria-labelledby="entrega-comprovada">
      <h2 id="entrega-comprovada" style={{ margin: 0 }}>
        Entrega comprovada
      </h2>
      {order.deliveryConfirmedAt ? (
        <Alert kind="success">
          Comprovada em {formatDateTime(order.deliveryConfirmedAt)}
          {order.hasDeliveryProof ? ' (foto anexada)' : ''}
          {order.receiptConfirmedAt ? ' · o comprador confirmou o recebimento' : ''}. Os prazos de
          desistência e garantia contam daqui.
        </Alert>
      ) : (
        <Alert kind="warning">
          Aguardando o comprador tocar em &quot;Recebi&quot;. Anexe uma foto da entrega para
          comprovar agora.
        </Alert>
      )}
      {order.hasDeliveryProof ? null : (
        <form className="row" onSubmit={(event) => void upload.submit(event)}>
          <div className="field">
            <label htmlFor="foto-entrega">Foto da entrega (PNG, JPG ou WebP)</label>
            <input
              id="foto-entrega"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={!file || upload.pending}
          >
            Anexar foto
          </button>
          <ErrorSummary error={upload.error} />
        </form>
      )}
    </section>
  );
}
