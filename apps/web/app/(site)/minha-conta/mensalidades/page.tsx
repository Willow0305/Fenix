'use client';

import { useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { PixPayment } from '../../../../components/pix-payment';
import { api } from '../../../../lib/api-client';
import { FEE_STATUS, type Fee } from '../../../../lib/finance-types';
import { formatDate, formatMoney, formatMonth, todayCivil } from '../../../../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../../../../lib/idempotency';
import { useResource } from '../../../../lib/use-resource';

function ProofForm({ fee, onDone }: { readonly fee: Fee; readonly onDone: () => Promise<void> }) {
  const idem = useIdempotencyKey();
  const [amount, setAmount] = useState(fee.remainingAmount.amount.replace('.', ','));
  const [paidOn, setPaidOn] = useState(todayCivil());
  const [file, setFile] = useState<File | null>(null);
  const action = useSubmit(async () => {
    const form = new FormData();

    form.set('amount', normalizeAmount(amount));
    form.set('paidOn', paidOn);

    if (file) {
      form.set('file', file);
    }

    await api(`/me/monthly-fees/${fee.id}/proof`, {
      method: 'POST',
      headers: idem.headers(),
      body: form
    });
    idem.rotate();
    await onDone();
  });

  return (
    <form className="form" onSubmit={(event) => void action.submit(event)}>
      <ErrorSummary error={action.error} />
      <div className="form-grid">
        <TextField
          label="Valor pago (R$)"
          maxLength={16}
          numeric="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          label="Data do PIX"
          type="date"
          required
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
        />
        <div className="field">
          <label htmlFor={`proof-${fee.id}`}>Comprovante (imagem ou PDF, até 10 MB)</label>
          <input
            id={`proof-${fee.id}`}
            type="file"
            required
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending || !file}>
          {action.pending ? 'Enviando…' : 'Enviar comprovante'}
        </button>
      </div>
    </form>
  );
}

export default function MyFeesPage() {
  const fees = useResource<Fee[]>('/me/monthly-fees');
  const pix = useResource<{ enabled: boolean }>('/public/pix');
  const payment = useResource<{ pixKey: string | null; bankingDetails: string | null }>(
    '/team-settings/payment-info'
  );
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Minhas mensalidades"
        description="Pague por PIX e envie o comprovante; a diretoria confirma o recebimento."
      />
      {payment.data?.pixKey ? (
        <div className="card">
          <strong>Chave PIX do time:</strong> <code>{payment.data.pixKey}</code>
          {payment.data.bankingDetails ? (
            <p className="prose muted">{payment.data.bankingDetails}</p>
          ) : null}
        </div>
      ) : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {fees.error ? <Alert kind="error">{fees.error}</Alert> : null}
      {fees.loading && !fees.data ? <Loading /> : null}
      {fees.data?.length === 0 ? <Empty>Nenhuma mensalidade gerada para você.</Empty> : null}
      {fees.data?.map((fee) => (
        <article key={fee.id} className="card stack" style={{ gap: '0.5rem' }}>
          <div className="row">
            <strong>{formatMonth(fee.referenceMonth)}</strong>
            <span className={`badge ${FEE_STATUS[fee.status].badge}`}>
              {FEE_STATUS[fee.status].label}
            </span>
            <span className="spacer" />
            <span>{formatMoney(fee.totalAmount.amount)}</span>
          </div>
          <span className="muted">
            Vencimento {formatDate(fee.dueDate)} · pago {formatMoney(fee.paidAmount.amount)} · em
            aberto {formatMoney(fee.remainingAmount.amount)}
            {fee.pendingAmount.amount !== '0.00'
              ? ` · ${formatMoney(fee.pendingAmount.amount)} em análise`
              : ''}
          </span>
          {(fee.status === 'OPEN' || fee.status === 'OVERDUE' || fee.status === 'PARTIALLY_PAID') &&
          fee.remainingAmount.amount !== fee.pendingAmount.amount ? (
            open === `pix-${fee.id}` ? (
              <PixPayment
                target={{ kind: 'fee', feeId: fee.id }}
                onPaid={() => {
                  setNotice('Mensalidade paga por PIX. Obrigado!');
                  void fees.reload();
                }}
              />
            ) : open === fee.id ? (
              <ProofForm
                fee={fee}
                onDone={async () => {
                  setOpen(null);
                  setNotice('Comprovante enviado! Você será avisado quando for confirmado.');
                  await fees.reload();
                }}
              />
            ) : (
              <div className="row">
                {pix.data?.enabled ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setOpen(`pix-${fee.id}`)}
                  >
                    Pagar com PIX (automático)
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOpen(fee.id)}
                >
                  Enviar comprovante de PIX
                </button>
              </div>
            )
          ) : null}
        </article>
      ))}
    </>
  );
}
