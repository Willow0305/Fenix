'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { AccountSelect, MethodSelect } from '../../../../components/finance-pickers';
import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { openProtectedFile } from '../../../../lib/download';
import {
  FEE_STATUS,
  type FeeDetail,
  PAYMENT_STATUS,
  type Payment
} from '../../../../lib/finance-types';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMonth,
  todayCivil
} from '../../../../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../../../../lib/idempotency';
import { useResource } from '../../../../lib/use-resource';

export default function FeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const fee = useResource<FeeDetail>(`/monthly-fees/${id}`);
  const idem = useIdempotencyKey();
  const reverseKey = useIdempotencyKey();
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '',
    paymentMethodId: '',
    paidOn: todayCivil(),
    notes: '',
    accountId: '',
    confirmNow: true
  });
  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [confirmAccount, setConfirmAccount] = useState('');
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [discount, setDiscount] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const record = useSubmit(async () => {
    const confirm = form.confirmNow && can('payments.confirm');
    const updated = await api<FeeDetail>(`/monthly-fees/${id}/payments`, {
      method: 'POST',
      headers: idem.headers(),
      body: {
        amount: normalizeAmount(form.amount),
        paymentMethodId: form.paymentMethodId,
        paidOn: form.paidOn,
        ...(form.notes ? { notes: form.notes } : {}),
        ...(confirm ? { accountId: form.accountId } : {})
      }
    });

    idem.rotate();
    fee.setData(updated);
    setForm({ ...form, amount: '', notes: '' });
    setNotice(
      confirm
        ? 'Pagamento registrado e lançado no Caixa.'
        : 'Pagamento registrado; aguardando confirmação.'
    );
  });

  if (!fee.data) {
    return fee.error ? <Alert kind="error">{fee.error}</Alert> : <Loading />;
  }

  const f = fee.data;
  const open = f.status !== 'CANCELLED' && f.status !== 'PAID';

  return (
    <>
      <PageHeader
        title={`${f.athlete.fullName} — ${formatMonth(f.referenceMonth)}`}
        description={`Plano ${f.plan.name} · vencimento ${formatDate(f.dueDate)}`}
        actions={<Link href="/admin/mensalidades">Voltar</Link>}
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {f.cancellationReason ? (
        <Alert kind="warning">Cancelada: {f.cancellationReason}</Alert>
      ) : null}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Situação</div>
          <div>
            <span className={`badge ${FEE_STATUS[f.status].badge}`}>
              {FEE_STATUS[f.status].label}
            </span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{formatMoney(f.totalAmount.amount)}</div>
          {f.discountAmount.amount !== '0.00' ? (
            <small className="muted">
              Desconto {formatMoney(f.discountAmount.amount)} sobre{' '}
              {formatMoney(f.originalAmount.amount)}
            </small>
          ) : null}
        </div>
        <div className="stat">
          <div className="stat-label">Pago (confirmado)</div>
          <div className="stat-value">{formatMoney(f.paidAmount.amount)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Em aberto</div>
          <div className="stat-value">{formatMoney(f.remainingAmount.amount)}</div>
          {f.pendingAmount.amount !== '0.00' ? (
            <small className="muted">
              {formatMoney(f.pendingAmount.amount)} aguardando confirmação
            </small>
          ) : null}
        </div>
      </div>

      <section className="card stack" aria-labelledby="pagamentos">
        <h2 id="pagamentos">Pagamentos</h2>
        {f.payments.length === 0 ? <p className="muted">Nenhum pagamento registrado.</p> : null}
        {f.payments.map((payment) => (
          <div
            key={payment.id}
            className="row"
            style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}
          >
            <strong>{formatMoney(payment.amount.amount)}</strong>
            <span>{payment.method.name}</span>
            <span className="muted">{payment.paidAt ? formatDateTime(payment.paidAt) : ''}</span>
            <span className={`badge ${PAYMENT_STATUS[payment.status].badge}`}>
              {PAYMENT_STATUS[payment.status].label}
            </span>
            {payment.createdBy ? <small className="muted">por {payment.createdBy}</small> : null}
            {payment.attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                className="btn btn-link"
                onClick={() =>
                  void openProtectedFile(`/payments/${payment.id}/attachments/${attachment.id}`)
                }
              >
                Ver comprovante
              </button>
            ))}
            <span className="spacer" />
            {payment.status === 'PENDING' && can('payments.confirm') ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setConfirming(payment)}
              >
                Confirmar
              </button>
            ) : null}
            {(payment.status === 'PENDING' || payment.status === 'CONFIRMED') &&
            can('payments.correct') ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReversing(payment)}
              >
                {payment.status === 'PENDING' ? 'Recusar' : 'Estornar'}
              </button>
            ) : null}
          </div>
        ))}

        {open && can('payments.record') ? (
          <form className="form" onSubmit={(event) => void record.submit(event)}>
            <h3>Registrar pagamento</h3>
            <ErrorSummary error={record.error} />
            <div className="form-grid">
              <TextField
                label="Valor (R$)"
                required
                inputMode="decimal"
                placeholder={f.remainingAmount.amount.replace('.', ',')}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                hint="Pagamentos parciais são aceitos."
              />
              <MethodSelect
                value={form.paymentMethodId}
                onChange={(value) => setForm({ ...form, paymentMethodId: value })}
              />
              <TextField
                label="Data do pagamento"
                type="date"
                required
                value={form.paidOn}
                onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
              />
              <TextField
                label="Observação"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {can('payments.confirm') ? (
              <>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.confirmNow}
                    onChange={(e) => setForm({ ...form, confirmNow: e.target.checked })}
                  />
                  <span>Confirmar agora e lançar no Caixa</span>
                </label>
                {form.confirmNow ? (
                  <AccountSelect
                    value={form.accountId}
                    onChange={(value) => setForm({ ...form, accountId: value })}
                  />
                ) : null}
              </>
            ) : null}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={record.pending}>
                {record.pending ? 'Registrando…' : 'Registrar pagamento'}
              </button>
              <button
                type="button"
                className="btn btn-link"
                onClick={() =>
                  setForm({ ...form, amount: f.remainingAmount.amount.replace('.', ',') })
                }
              >
                Usar valor em aberto
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {f.status !== 'CANCELLED' && can('fees.adjust') ? (
        <section className="card row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDiscount(f.discountAmount.amount.replace('.', ','));
              setAdjusting(true);
            }}
          >
            Aplicar desconto / isenção
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setCancelling(true)}>
            Cancelar mensalidade
          </button>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title="Confirmar pagamento"
        description={`Confirma o recebimento de ${formatMoney(confirming?.amount.amount)}? Será lançado no Caixa.`}
        confirmLabel="Confirmar recebimento"
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          fee.setData(
            await api<FeeDetail>(`/monthly-fees/${id}/payments/${confirming?.id ?? ''}/confirm`, {
              method: 'POST',
              body: { accountId: confirmAccount }
            })
          );
          setNotice('Pagamento confirmado e lançado no Caixa.');
        }}
      >
        <AccountSelect value={confirmAccount} onChange={setConfirmAccount} />
      </ConfirmDialog>
      <ConfirmDialog
        open={reversing !== null}
        title={reversing?.status === 'PENDING' ? 'Recusar pagamento' : 'Estornar pagamento'}
        description={
          reversing?.status === 'PENDING'
            ? 'O pagamento será cancelado e o valor volta a ficar em aberto.'
            : 'Será registrado um reembolso com saída vinculada no Caixa. O lançamento original é preservado.'
        }
        confirmLabel={reversing?.status === 'PENDING' ? 'Recusar' : 'Estornar'}
        danger
        requireReason
        onClose={() => setReversing(null)}
        onConfirm={async (reason) => {
          fee.setData(
            await api<FeeDetail>(`/monthly-fees/${id}/payments/${reversing?.id ?? ''}/reverse`, {
              method: 'POST',
              headers: reverseKey.headers(),
              body: { reason }
            })
          );
          reverseKey.rotate();
          setNotice('Pagamento estornado/cancelado.');
        }}
      />
      <ConfirmDialog
        open={adjusting}
        title="Desconto ou isenção"
        description={`Valor original: ${formatMoney(f.originalAmount.amount)}. Para isentar, informe o valor total como desconto.`}
        confirmLabel="Aplicar"
        requireReason
        onClose={() => setAdjusting(false)}
        onConfirm={async (reason) => {
          fee.setData(
            await api<FeeDetail>(`/monthly-fees/${id}/adjust`, {
              method: 'POST',
              body: { discountAmount: normalizeAmount(discount || '0'), reason }
            })
          );
          setNotice('Ajuste aplicado.');
        }}
      >
        <TextField
          label="Desconto (R$)"
          inputMode="decimal"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={cancelling}
        title="Cancelar mensalidade"
        description="Só é possível cancelar sem pagamentos. O registro permanece no histórico."
        confirmLabel="Cancelar mensalidade"
        danger
        requireReason
        onClose={() => setCancelling(false)}
        onConfirm={async (reason) => {
          fee.setData(
            await api<FeeDetail>(`/monthly-fees/${id}/cancel`, { method: 'POST', body: { reason } })
          );
        }}
      />
    </>
  );
}
