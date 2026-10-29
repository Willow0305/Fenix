'use client';

import { useEffect, useRef, useState } from 'react';

import { api, errorMessage } from '../lib/api-client';
import { formatMoney } from '../lib/format';
import { Icon } from './icon';
import { Alert, SelectField } from './ui';

interface CardCheckout {
  orderId: string;
  orderNumber: string;
  amount: { amount: string; currency: string };
  maxInstallments: number;
  interestFreeUpTo: number;
  publicKey: string | null;
  simulated: boolean;
  payerEmail: string | null;
}

interface CardCharge {
  id: string;
  status: 'PENDING' | 'PAID' | 'REJECTED' | 'REVIEW' | 'CANCELLED';
  installments: number;
  interestFree: boolean;
  brand: string | null;
  lastFour: string | null;
  message: string | null;
}

/** Dados que o formulário do Mercado Pago devolve no envio (Card Payment Brick). */
interface BrickFormData {
  token: string;
  issuer_id?: string;
  payment_method_id: string;
  installments: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
}

interface BrickController {
  unmount: () => void;
}

interface MercadoPagoSdk {
  bricks: () => {
    create: (
      brick: 'cardPayment',
      containerId: string,
      settings: {
        initialization: { amount: number; payer?: { email?: string } };
        customization: { paymentMethods: { maxInstallments: number; minInstallments: number } };
        callbacks: {
          onReady: () => void;
          onSubmit: (data: BrickFormData, extra?: { paymentTypeId?: string }) => Promise<void>;
          onError: (error: unknown) => void;
        };
      }
    ) => Promise<BrickController>;
  };
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options: { locale: string }) => MercadoPagoSdk;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const POLL_MS = 5_000;

export type CardTarget =
  | { readonly kind: 'order'; readonly orderId: string }
  | { readonly kind: 'guest'; readonly orderNumber: string; readonly code: string };

/** Carrega o SDK do Mercado Pago uma vez (fora do pacote do site). */
function loadSdk(): Promise<void> {
  if (window.MercadoPago) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível abrir o formulário do cartão.'));
    document.head.appendChild(script);
  });
}

/**
 * Pagar com cartão pelo site (DT-079). O formulário é do Mercado Pago: os dados do cartão
 * não passam pelo clube, só o token. Até 12x; acima do "sem juros", os juros são do comprador.
 */
export function CardPayment({
  target,
  onPaid
}: {
  readonly target: CardTarget;
  readonly onPaid: () => void;
}) {
  const [info, setInfo] = useState<CardCheckout | null>(null);
  const [charge, setCharge] = useState<CardCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [installments, setInstallments] = useState('1');
  const [type, setType] = useState<'credit_card' | 'debit_card'>('credit_card');
  const brick = useRef<BrickController | null>(null);
  const guest =
    target.kind === 'guest' ? { orderNumber: target.orderNumber, code: target.code } : null;
  const containerId = `cartao-${target.kind === 'order' ? target.orderId : target.orderNumber}`;

  async function submit(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const result = guest
        ? await api<CardCharge>('/public/orders/card', {
            method: 'POST',
            body: { ...body, ...guest },
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            auth: false
          })
        : await api<CardCharge>(
            `/me/orders/${target.kind === 'order' ? target.orderId : ''}/card`,
            {
              method: 'POST',
              body,
              headers: { 'Idempotency-Key': crypto.randomUUID() }
            }
          );

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

  // Dados do formulário (valor que falta, parcelas e sem juros).
  useEffect(() => {
    let cancelled = false;

    (guest
      ? api<CardCheckout>('/public/orders/card/checkout', {
          method: 'POST',
          body: guest,
          auth: false
        })
      : api<CardCheckout>(`/me/orders/${target.kind === 'order' ? target.orderId : ''}/card`)
    )
      .then((result) => {
        if (!cancelled) {
          setInfo(result);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setError(errorMessage(failure));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Modo real: monta o formulário do Mercado Pago.
  useEffect(() => {
    if (!info || info.simulated || !info.publicKey || charge?.status === 'PAID') {
      return;
    }

    let disposed = false;

    loadSdk()
      .then(async () => {
        if (disposed || !window.MercadoPago || !info.publicKey) {
          return;
        }

        const sdk = new window.MercadoPago(info.publicKey, { locale: 'pt-BR' });

        brick.current = await sdk.bricks().create('cardPayment', containerId, {
          initialization: {
            amount: Number(info.amount.amount),
            ...(info.payerEmail ? { payer: { email: info.payerEmail } } : {})
          },
          customization: {
            paymentMethods: { maxInstallments: info.maxInstallments, minInstallments: 1 }
          },
          callbacks: {
            onReady: () => undefined,
            onSubmit: (data, extra) =>
              submit({
                token: data.token,
                paymentMethodId: data.payment_method_id,
                installments: data.installments,
                paymentType: extra?.paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card',
                ...(data.issuer_id ? { issuerId: String(data.issuer_id) } : {}),
                ...(data.payer?.email ? { payerEmail: data.payer.email } : {}),
                ...(data.payer?.identification?.type && data.payer.identification.number
                  ? {
                      identificationType: data.payer.identification.type,
                      identificationNumber: data.payer.identification.number.replace(/\D/g, '')
                    }
                  : {})
              }),
            onError: () => setError('Não foi possível abrir o formulário do cartão.')
          }
        });
      })
      .catch((failure: unknown) => setError(errorMessage(failure)));

    return () => {
      disposed = true;
      brick.current?.unmount();
      brick.current = null;
    };
  }, [info]);

  // Em análise no banco: confere sozinho a cada 5 segundos.
  useEffect(() => {
    if (charge?.status !== 'PENDING') {
      return;
    }

    const timer = window.setInterval(() => {
      void (
        guest
          ? api<CardCharge>(`/public/card/${charge.id}/status`, {
              method: 'POST',
              body: guest,
              auth: false
            })
          : api<CardCharge>(`/me/card/${charge.id}`)
      ).then((result) => {
        setCharge(result);

        if (result.status === 'PAID') {
          onPaid();
        }
      });
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [charge]);

  if (charge?.status === 'PAID') {
    return (
      <Alert kind="success">
        Pagamento com cartão aprovado ({charge.installments}x
        {charge.lastFour ? `, final ${charge.lastFour}` : ''}). Obrigado!
      </Alert>
    );
  }

  const count = Number(installments);
  const options = info
    ? Array.from({ length: type === 'debit_card' ? 1 : info.maxInstallments }, (_, i) => i + 1).map(
        (n) => ({
          value: String(n),
          label:
            n === 1
              ? `À vista · ${formatMoney(info.amount.amount)}`
              : n <= info.interestFreeUpTo
                ? `${n}x de ${formatMoney((Number(info.amount.amount) / n).toFixed(2))} sem juros`
                : `${n}x com juros (calculados pelo Mercado Pago)`
        })
      )
    : [];

  return (
    <section className="card stack" aria-labelledby="pagar-cartao">
      <h2 id="pagar-cartao" className="m-0">
        <Icon name="credit-card" /> Pagar com cartão
      </h2>
      {info ? (
        <p className="m-0">
          {formatMoney(info.amount.amount)} em até {info.maxInstallments}x
          {info.interestFreeUpTo >= 2
            ? `, até ${info.interestFreeUpTo}x sem juros`
            : ' (parcelado com juros pagos pelo comprador)'}
          .
        </p>
      ) : null}
      {error ? <Alert kind="error">{error}</Alert> : null}
      {charge?.status === 'REJECTED' ? <Alert kind="error">{charge.message}</Alert> : null}
      {charge?.status === 'PENDING' ? <Alert kind="info">{charge.message}</Alert> : null}

      {info?.simulated ? (
        <div className="stack gap-sm">
          <Alert kind="warning">
            Modo de teste: nenhum cartão é cobrado. Escolha o resultado para simular.
          </Alert>
          <div className="form-grid">
            <SelectField
              label="Tipo"
              value={type}
              onChange={(e) => {
                setType(e.target.value === 'debit_card' ? 'debit_card' : 'credit_card');
                setInstallments('1');
              }}
              options={[
                { value: 'credit_card', label: 'Crédito' },
                { value: 'debit_card', label: 'Débito (à vista)' }
              ]}
            />
            <SelectField
              label="Parcelas"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              options={options}
            />
          </div>
          <div className="row gap-sm">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || charge?.status === 'PENDING'}
              onClick={() =>
                void submit({
                  token: 'sandbox-approved',
                  paymentMethodId: type === 'debit_card' ? 'debvisa' : 'visa',
                  installments: count,
                  paymentType: type
                })
              }
            >
              Simular cartão aprovado
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || charge?.status === 'PENDING'}
              onClick={() =>
                void submit({
                  token: 'sandbox-rejected',
                  paymentMethodId: 'visa',
                  installments: count,
                  paymentType: type
                })
              }
            >
              Simular recusado
            </button>
          </div>
        </div>
      ) : info && !info.publicKey ? (
        <Alert kind="warning">Pagamento com cartão indisponível agora. Use o PIX.</Alert>
      ) : (
        <div id={containerId} />
      )}
      <small className="muted">
        Os dados do cartão são digitados no formulário do Mercado Pago e não passam pelo Fênix.
      </small>
    </section>
  );
}
