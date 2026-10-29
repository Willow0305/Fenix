'use client';

import { useEffect, useState } from 'react';

import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { formatDateTime, formatMoney } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Alert, ConfirmDialog, Empty, ErrorSummary, TextField, useSubmit } from './ui';

interface CardAdmin {
  provider: 'off' | 'sandbox' | 'mercadopago';
  enabled: boolean;
  differentialPricing: { installments: number; id: string }[];
  review: {
    id: string;
    reference: string;
    amount: { amount: string };
    paidAt: string | null;
    reason: string | null;
  }[];
  refundFailures: {
    refundId: string;
    reference: string;
    amount: { amount: string };
    error: string | null;
  }[];
}

const PROVIDER: Record<CardAdmin['provider'], string> = {
  off: 'Desligado',
  sandbox: 'Modo de teste (nenhum cartão é cobrado)',
  mercadopago: 'Mercado Pago'
};

/**
 * Cartão pelo site no painel (DT-079): situação, códigos de "sem juros" do Mercado Pago
 * (PEN-067), pagamentos para revisar e estornos que não foram enviados.
 */
export function CardAdminPanel() {
  const { can } = useAuth();
  const card = useResource<CardAdmin>('/payments/card');
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [resolving, setResolving] = useState<{
    chargeId?: string;
    refundId?: string;
    label: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (card.data) {
      setCodes(
        Object.fromEntries(
          card.data.differentialPricing.map((entry) => [entry.installments, entry.id])
        )
      );
    }
  }, [card.data]);

  const save = useSubmit(async () => {
    card.setData(
      await api<CardAdmin>('/payments/card/differential-pricing', {
        method: 'PUT',
        body: {
          entries: Object.entries(codes)
            .filter(([, id]) => id.trim())
            .map(([installments, id]) => ({ installments: Number(installments), id: id.trim() }))
        }
      })
    );
    setNotice('Códigos de sem juros salvos.');
  });

  if (!card.data) {
    return card.error ? <Alert kind="error">{card.error}</Alert> : null;
  }

  const c = card.data;

  return (
    <section className="card stack" aria-labelledby="cartao-site">
      <h2 id="cartao-site" className="m-0">
        Cartão pelo site
      </h2>
      <p className="m-0">
        Situação: <strong>{PROVIDER[c.provider]}</strong>. Crédito em até 12x (juros do parcelado
        pagos pelo comprador) ou débito. O dinheiro cai na mesma conta do Caixa do PIX automático.
      </p>
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {can('finance.setup') ? (
        <form className="form" onSubmit={(event) => void save.submit(event)}>
          <h3 className="h-small m-0">Parcelas sem juros por produto</h3>
          <p className="muted m-0">
            Cada produto escolhe &quot;sem juros até N&quot; no cadastro. Para valer de verdade, o
            Mercado Pago cria um código de &quot;preço diferenciado&quot; para cada N; cole os
            códigos aqui. Sem código, a parcela fica com juros do comprador.
          </p>
          <ErrorSummary error={save.error} />
          <div className="form-grid">
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <TextField
                key={n}
                label={`Código para ${n}x sem juros`}
                maxLength={60}
                value={codes[n] ?? ''}
                onChange={(e) => setCodes({ ...codes, [n]: e.target.value })}
              />
            ))}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
              Salvar códigos
            </button>
          </div>
        </form>
      ) : null}

      <h3 className="h-small m-0">Pagamentos com cartão para revisar ({c.review.length})</h3>
      {c.review.length === 0 ? <Empty>Nada para revisar.</Empty> : null}
      {c.review.map((row) => (
        <article key={row.id} className="row">
          <strong>{row.reference}</strong>
          <span>{formatMoney(row.amount.amount)}</span>
          <span className="muted">{row.paidAt ? formatDateTime(row.paidAt) : ''}</span>
          <span className="muted">{row.reason}</span>
          <span className="spacer" />
          {can('payments.correct') ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setResolving({ chargeId: row.id, label: row.reference })}
            >
              Marcar como resolvido
            </button>
          ) : null}
        </article>
      ))}

      <h3 className="h-small m-0">Estornos de cartão não enviados ({c.refundFailures.length})</h3>
      {c.refundFailures.length === 0 ? <Empty>Todos os estornos foram enviados.</Empty> : null}
      {c.refundFailures.map((row) => (
        <article key={row.refundId} className="row">
          <strong>{row.reference}</strong>
          <span>{formatMoney(row.amount.amount)}</span>
          <span className="muted">{row.error}</span>
          <span className="spacer" />
          {can('payments.correct') ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setResolving({ refundId: row.refundId, label: row.reference })}
            >
              Estornei no Mercado Pago
            </button>
          ) : null}
        </article>
      ))}

      <ConfirmDialog
        open={resolving !== null}
        title={`Resolver: ${resolving?.label ?? ''}`}
        description="Descreva o que foi feito no painel do Mercado Pago."
        confirmLabel="Marcar como resolvido"
        requireReason
        onClose={() => setResolving(null)}
        onConfirm={async (reason) => {
          card.setData(
            await api<CardAdmin>('/payments/card/resolve', {
              method: 'POST',
              body: {
                reason,
                ...(resolving?.chargeId ? { chargeId: resolving.chargeId } : {}),
                ...(resolving?.refundId ? { refundId: resolving.refundId } : {})
              }
            })
          );
          setNotice('Resolvido.');
        }}
      />
    </section>
  );
}
