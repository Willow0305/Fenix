'use client';

import { useEffect, useState } from 'react';

import { api } from '../lib/api-client';
import { formatDateTime, formatMoney } from '../lib/format';
import { RETURN_STATUS, type OrderRights } from '../lib/store-types';
import { Alert, ErrorSummary, TextArea, useSubmit } from './ui';

type Target =
  | { readonly kind: 'user'; readonly orderId: string }
  | { readonly kind: 'guest'; readonly orderNumber: string; readonly code: string };

/**
 * Entrega, desistência e defeito do pedido (DT-070): "Recebi", prazos e pedidos de troca ou
 * devolução. Funciona com conta ou com o número e o código do pedido (visitante).
 */
export function OrderRightsPanel({ target }: { readonly target: Target }) {
  const [rights, setRights] = useState<OrderRights | null>(null);
  const [mode, setMode] = useState<'WITHDRAWAL' | 'DEFECT' | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [description, setDescription] = useState('');
  const guestBody =
    target.kind === 'guest' ? { orderNumber: target.orderNumber, code: target.code } : {};

  // Depende só dos valores, não do objeto (que é novo a cada renderização).
  const targetKey =
    target.kind === 'user' ? target.orderId : `${target.orderNumber}:${target.code}`;

  useEffect(() => {
    let cancelled = false;
    const request =
      target.kind === 'user'
        ? api<OrderRights>(`/me/orders/${target.orderId}/rights`)
        : api<OrderRights>('/public/orders/rights', {
            method: 'POST',
            body: { orderNumber: target.orderNumber, code: target.code },
            auth: false
          });

    void request.then(
      (data) => {
        if (!cancelled) {
          setRights(data);
        }
      },
      () => undefined
    );

    return () => {
      cancelled = true;
    };
    // `target` é lido pelos valores que formam `targetKey`.
  }, [targetKey]);

  const receipt = useSubmit(async () => {
    setRights(
      await api<OrderRights>(
        target.kind === 'user' ? `/me/orders/${target.orderId}/receipt` : '/public/orders/receipt',
        { method: 'POST', body: guestBody, ...(target.kind === 'guest' ? { auth: false } : {}) }
      )
    );
  });
  const send = useSubmit(async () => {
    if (!mode) {
      return;
    }

    setRights(
      await api<OrderRights>(
        target.kind === 'user' ? `/me/orders/${target.orderId}/returns` : '/public/orders/returns',
        {
          method: 'POST',
          body: {
            ...guestBody,
            kind: mode,
            items: Object.entries(quantities)
              .filter(([, quantity]) => quantity > 0)
              .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
            ...(description.trim() ? { description: description.trim() } : {})
          },
          ...(target.kind === 'guest' ? { auth: false } : {})
        }
      )
    );
    setMode(null);
    setQuantities({});
    setDescription('');
    send.setMessage('Pedido enviado. A diretoria vai responder por aqui e por aviso.');
  });

  if (!rights) {
    return null;
  }

  const eligible = rights.items.filter(
    (item) => item.available > 0 && (mode !== 'WITHDRAWAL' || !item.personalized)
  );
  const withdrawable = rights.items.some((item) => item.available > 0 && !item.personalized);

  return (
    <section className="card stack" aria-labelledby="direitos">
      <h2 id="direitos" style={{ margin: 0 }}>
        Entrega, troca e devolução
      </h2>
      {rights.awaitingReceipt ? (
        <Alert kind="info">
          A diretoria registrou a entrega. Recebeu tudo certo? Confirme abaixo: os prazos de
          desistência (7 dias) e garantia (90 dias) contam a partir da confirmação.
        </Alert>
      ) : null}
      {rights.awaitingReceipt ? (
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={receipt.pending}
            onClick={() => void receipt.submit()}
          >
            Recebi o pedido
          </button>
          <ErrorSummary error={receipt.error} />
        </div>
      ) : null}
      {rights.withdrawalUntil ? (
        <p className="muted" style={{ margin: 0 }}>
          Entrega comprovada em {formatDateTime(rights.deliveryConfirmedAt)}. Desistência até{' '}
          {formatDateTime(rights.withdrawalUntil)}; garantia contra defeito até{' '}
          {formatDateTime(rights.defectUntil)}.
        </p>
      ) : rights.canWithdraw ? (
        <p className="muted" style={{ margin: 0 }}>
          Mudou de ideia? Você pode desistir da compra (exceto itens personalizados) até 7 dias
          depois de receber, com estorno integral.
        </p>
      ) : null}
      {send.message ? <Alert kind="success">{send.message}</Alert> : null}
      {mode === null ? (
        <div className="row">
          {rights.canWithdraw && withdrawable ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setMode('WITHDRAWAL')}
            >
              Desistir da compra
            </button>
          ) : null}
          {rights.canReportDefect ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setMode('DEFECT')}
            >
              Problema com o produto
            </button>
          ) : null}
        </div>
      ) : (
        <form className="stack" onSubmit={(event) => void send.submit(event)}>
          <strong>{mode === 'WITHDRAWAL' ? 'Desistir da compra' : 'Problema com o produto'}</strong>
          <small className="muted">
            {mode === 'WITHDRAWAL'
              ? 'Não é preciso dizer o motivo. Itens personalizados não entram na desistência.'
              : 'Conte o que aconteceu; a diretoria responde com troca, conserto ou estorno.'}
          </small>
          <ErrorSummary error={send.error} />
          {eligible.map((item) => (
            <label key={item.orderItemId} className="row">
              <span style={{ flex: '1 1 12rem' }}>{item.productName}</span>
              <select
                aria-label={`Quantidade de ${item.productName}`}
                value={quantities[item.orderItemId] ?? 0}
                onChange={(e) =>
                  setQuantities({ ...quantities, [item.orderItemId]: Number(e.target.value) })
                }
              >
                {Array.from({ length: item.available + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <TextArea
            label={mode === 'WITHDRAWAL' ? 'Motivo (opcional)' : 'Descreva o problema'}
            maxLength={2000}
            required={mode === 'DEFECT'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={send.pending}>
              Enviar
            </button>
            <button type="button" className="btn btn-link" onClick={() => setMode(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {rights.returns.length > 0 ? (
        <ul className="stack" style={{ gap: '0.5rem', paddingLeft: 0, listStyle: 'none' }}>
          {rights.returns.map((r) => (
            <li key={r.id} className="card" style={{ padding: '0.75rem' }}>
              <strong>{r.kind === 'WITHDRAWAL' ? 'Desistência' : 'Defeito'}</strong> ·{' '}
              <span className={`badge ${RETURN_STATUS[r.status].badge}`}>
                {RETURN_STATUS[r.status].label}
              </span>
              <div className="muted">
                {r.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
              </div>
              {r.refundAmount ? <div>Estorno: {formatMoney(r.refundAmount.amount)}</div> : null}
              {r.response ? <div>Resposta: {r.response}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
