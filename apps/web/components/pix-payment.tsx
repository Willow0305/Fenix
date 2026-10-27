'use client';

import { useEffect, useState } from 'react';

import { api, errorMessage } from '../lib/api-client';
import { formatDateTime, formatMoney } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Icon } from './icon';
import { QrImage } from './member-card';
import { Alert } from './ui';

export interface PixCharge {
  id: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REVIEW';
  amount: { amount: string; currency: string };
  qrCode: string;
  qrSvg: string;
  expiresAt: string;
  paidAt: string | null;
  simulated: boolean;
}

export type PixTarget =
  | { readonly kind: 'order'; readonly orderId: string }
  | { readonly kind: 'guest'; readonly orderNumber: string; readonly code: string }
  | { readonly kind: 'fee'; readonly feeId: string };

const POLL_MS = 5_000;

/**
 * Pagar com PIX automático (DT-071): QR e "copia e cola" do intermediário; a tela confere a
 * situação sozinha e avisa quando a baixa acontece. Só aparece com o PIX automático ligado.
 */
export function PixPayment({
  target,
  onPaid
}: {
  readonly target: PixTarget;
  readonly onPaid: () => void;
}) {
  const availability = useResource<{ enabled: boolean; simulated: boolean }>('/public/pix');
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const guest =
    target.kind === 'guest' ? { orderNumber: target.orderNumber, code: target.code } : null;

  async function run(action: () => Promise<PixCharge>) {
    setBusy(true);
    setError(null);

    try {
      const result = await action();

      setCharge(result);

      if (result.status === 'PAID') {
        onPaid();
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(() =>
      target.kind === 'order'
        ? api<PixCharge>(`/me/orders/${target.orderId}/pix`, { method: 'POST', body: {} })
        : target.kind === 'fee'
          ? api<PixCharge>(`/me/monthly-fees/${target.feeId}/pix`, { method: 'POST', body: {} })
          : api<PixCharge>('/public/orders/pix', { method: 'POST', body: guest, auth: false })
    );
  const check = (id: string) =>
    guest
      ? api<PixCharge>(`/public/pix/${id}/status`, { method: 'POST', body: guest, auth: false })
      : api<PixCharge>(`/me/pix/${id}`);
  const simulate = (id: string) =>
    run(() =>
      guest
        ? api<PixCharge>(`/public/pix/${id}/simulate`, { method: 'POST', body: guest, auth: false })
        : api<PixCharge>(`/me/pix/${id}/simulate`, { method: 'POST', body: {} })
    );

  // Confere a situação a cada 5 s enquanto o QR estiver aberto e pendente.
  const pendingId = charge?.status === 'PENDING' ? charge.id : null;

  useEffect(() => {
    if (!pendingId) {
      return;
    }

    const timer = window.setInterval(() => {
      void check(pendingId).then(
        (updated) => {
          setCharge(updated);

          if (updated.status === 'PAID') {
            onPaid();
          }
        },
        () => undefined
      );
    }, POLL_MS);

    return () => window.clearInterval(timer);
    // `check` e `onPaid` só dependem do alvo, que não muda enquanto o QR está aberto.
  }, [pendingId]);

  if (!availability.data?.enabled) {
    return null;
  }

  return (
    <section className="card stack" aria-labelledby="pix-automatico">
      <h2 id="pix-automatico" style={{ margin: 0 }}>
        <Icon name="qr-code" /> Pagar com PIX (confirmação automática)
      </h2>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {charge === null ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            Gere o QR e pague no app do seu banco: a confirmação chega sozinha, sem enviar
            comprovante.
          </p>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void create()}
            >
              {busy ? 'Gerando…' : 'Gerar QR PIX'}
            </button>
          </div>
        </>
      ) : charge.status === 'PAID' ? (
        <Alert kind="success">
          Pagamento de {formatMoney(charge.amount.amount)} confirmado em{' '}
          {formatDateTime(charge.paidAt)}. Obrigado!
        </Alert>
      ) : charge.status === 'REVIEW' ? (
        <Alert kind="warning">
          Recebemos o PIX, mas ele precisa de conferência da diretoria. Você será avisado.
        </Alert>
      ) : charge.status === 'PENDING' ? (
        <div className="row" style={{ alignItems: 'flex-start', gap: '1.25rem' }}>
          <div style={{ width: '12rem', background: '#fff', padding: '0.5rem', borderRadius: 8 }}>
            <QrImage svg={charge.qrSvg} label="QR do PIX" />
          </div>
          <div className="stack" style={{ flex: '1 1 16rem', gap: '0.5rem' }}>
            <strong>{formatMoney(charge.amount.amount)}</strong>
            <small className="muted">Válido até {formatDateTime(charge.expiresAt)}.</small>
            <label className="field">
              <span className="label">PIX copia e cola</span>
              <textarea
                readOnly
                rows={3}
                value={charge.qrCode}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  void navigator.clipboard.writeText(charge.qrCode).then(() => setCopied(true))
                }
              >
                <Icon name="clipboard" /> {copied ? 'Copiado!' : 'Copiar código'}
              </button>
              {charge.simulated ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() => void simulate(charge.id)}
                >
                  Simular pagamento (modo de teste)
                </button>
              ) : null}
            </div>
            <small className="muted" role="status">
              Aguardando o pagamento… esta tela atualiza sozinha.
            </small>
          </div>
        </div>
      ) : (
        <>
          <Alert kind="warning">Este QR venceu ou foi cancelado. Gere outro para pagar.</Alert>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void create()}
            >
              Gerar novo QR
            </button>
          </div>
        </>
      )}
    </section>
  );
}
