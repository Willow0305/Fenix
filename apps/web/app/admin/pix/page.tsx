'use client';

import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  PageHeader,
  SelectField,
  Skeleton
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import type { Account } from '../../../lib/finance-types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

interface PixAdmin {
  provider: 'off' | 'sandbox' | 'mercadopago';
  enabled: boolean;
  accountId: string | null;
  review: {
    id: string;
    purpose: 'ORDER' | 'MONTHLY_FEE';
    reference: string;
    amount: { amount: string };
    paidAt: string | null;
    reason: string | null;
  }[];
}

const PROVIDER: Record<PixAdmin['provider'], string> = {
  off: 'Desligado',
  sandbox: 'Modo de teste (pagamentos simulados)',
  mercadopago: 'Mercado Pago'
};

/**
 * PIX automático (DT-071): intermediário em uso, conta do Caixa que recebe e PIX que chegaram
 * fora do esperado (pedido cancelado, valor diferente) para a diretoria decidir.
 */
export default function PixAdminPage() {
  const { can } = useAuth();
  const pix = useResource<PixAdmin>('/payments/pix');
  const accounts = useResource<Account[]>('/finance/accounts');
  const [resolving, setResolving] = useState<PixAdmin['review'][number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function setAccount(accountId: string) {
    pix.setData(
      await api<PixAdmin>('/payments/pix/account', { method: 'PUT', body: { accountId } })
    );
    setNotice('Conta do PIX automático atualizada.');
  }

  if (!pix.data) {
    return pix.error ? <Alert kind="error">{pix.error}</Alert> : <Skeleton lines={4} />;
  }

  const p = pix.data;

  return (
    <>
      <PageHeader
        title="PIX automático"
        description="Pagamentos de pedidos e mensalidades confirmados sozinhos pelo intermediário."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <section className="card stack" aria-labelledby="pix-situacao">
        <h2 id="pix-situacao" style={{ margin: 0 }}>
          Situação
        </h2>
        <p style={{ margin: 0 }}>
          Intermediário: <strong>{PROVIDER[p.provider]}</strong>
          {p.enabled
            ? ''
            : ' — o botão "Pagar com PIX" não aparece; vale só o PIX com comprovante.'}
        </p>
        {p.provider === 'sandbox' ? (
          <Alert kind="warning">
            Modo de teste: os QR não podem ser pagos de verdade. Para produção, configure o Mercado
            Pago no servidor (PIX_PROVIDER=mercadopago, token e segredo do webhook).
          </Alert>
        ) : null}
        <SelectField
          label="Conta do Caixa que recebe o PIX"
          value={p.accountId ?? ''}
          disabled={!can('finance.setup')}
          onChange={(e) => void setAccount(e.target.value)}
          options={[
            { value: '', label: 'Padrão: Conta bancária / PIX' },
            ...(accounts.data ?? [])
              .filter((a) => a.isActive)
              .map((a) => ({ value: a.id, label: a.name }))
          ]}
        />
      </section>

      <section className="card stack" aria-labelledby="pix-revisar">
        <h2 id="pix-revisar" style={{ margin: 0 }}>
          PIX para revisar ({p.review.length})
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Dinheiro que chegou, mas não foi baixado: o pedido já tinha sido cancelado ou o valor não
          batia. Estorne no painel do intermediário ou registre o pagamento manualmente e marque
          como resolvido.
        </p>
        {p.review.length === 0 ? <Empty>Nada para revisar.</Empty> : null}
        {p.review.map((r) => (
          <article key={r.id} className="row card" style={{ padding: '0.75rem' }}>
            <div className="stack" style={{ flex: '1 1 16rem', gap: '0.2rem' }}>
              <strong>
                {r.reference} · {formatMoney(r.amount.amount)}
              </strong>
              <span className="muted">
                Pago em {formatDateTime(r.paidAt)} — {r.reason}
              </span>
            </div>
            {can('payments.correct') ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setResolving(r)}
              >
                Marcar como resolvido
              </button>
            ) : null}
          </article>
        ))}
      </section>

      <ConfirmDialog
        open={resolving !== null}
        title={`Resolver: ${resolving?.reference ?? ''}`}
        description="Descreva o que foi feito (ex.: estornado no Mercado Pago em 27/10)."
        confirmLabel="Marcar como resolvido"
        requireReason
        onClose={() => setResolving(null)}
        onConfirm={async (reason) => {
          pix.setData(
            await api<PixAdmin>(`/payments/pix/${resolving?.id ?? ''}/resolve`, {
              method: 'POST',
              body: { reason }
            })
          );
          setNotice('Revisão resolvida.');
        }}
      />
    </>
  );
}
