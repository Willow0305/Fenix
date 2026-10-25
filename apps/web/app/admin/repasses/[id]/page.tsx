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
import { formatDate, formatDateTime, formatMoney, todayCivil } from '../../../../lib/format';
import { useIdempotencyKey } from '../../../../lib/idempotency';
import {
  type Settlement,
  SETTLEMENT_STATUS,
  type SettlementStatus
} from '../../../../lib/partner-types';
import { useResource } from '../../../../lib/use-resource';

const NEXT: Record<SettlementStatus, { status: SettlementStatus; label: string }[]> = {
  DRAFT: [
    { status: 'PENDING', label: 'Enviar para aprovação' },
    { status: 'CANCELLED', label: 'Cancelar' }
  ],
  PENDING: [
    { status: 'APPROVED', label: 'Aprovar' },
    { status: 'DRAFT', label: 'Devolver para rascunho' },
    { status: 'CANCELLED', label: 'Cancelar' }
  ],
  APPROVED: [{ status: 'CANCELLED', label: 'Cancelar' }],
  PAID: [],
  CANCELLED: []
};

export default function SettlementPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const settlement = useResource<Settlement>(`/settlements/${id}`);
  const [next, setNext] = useState<SettlementStatus | null>(null);
  const [payment, setPayment] = useState({
    accountId: '',
    paymentMethodId: '',
    paidOn: todayCivil()
  });
  const idempotency = useIdempotencyKey();
  const pay = useSubmit(async () => {
    settlement.setData(
      await api<Settlement>(`/settlements/${id}/pay`, {
        method: 'POST',
        headers: idempotency.headers(),
        body: {
          accountId: payment.accountId,
          paidOn: payment.paidOn,
          ...(payment.paymentMethodId ? { paymentMethodId: payment.paymentMethodId } : {})
        }
      })
    );
    idempotency.rotate();
  });

  if (settlement.loading && !settlement.data) {
    return <Loading />;
  }

  if (settlement.error || !settlement.data) {
    return <Alert kind="error">{settlement.error ?? 'Repasse não encontrado.'}</Alert>;
  }

  const s = settlement.data;

  return (
    <>
      <PageHeader
        title={`Repasse — ${s.partner.name}`}
        description={`Vendas pagas de ${formatDate(s.periodStart)} a ${formatDate(s.periodEnd)}`}
        actions={
          <Link href={`/admin/parceiros/${s.partner.id}`} className="btn btn-secondary">
            Ficha do parceiro
          </Link>
        }
      />
      <section className="card stack" aria-label="Resumo">
        <div className="row">
          <span className={`badge ${SETTLEMENT_STATUS[s.status].badge}`}>
            {SETTLEMENT_STATUS[s.status].label}
          </span>
          {s.dueDate ? <span className="muted">Vencimento {formatDate(s.dueDate)}</span> : null}
          {s.paidAt ? <span className="muted">Pago em {formatDateTime(s.paidAt)}</span> : null}
          <span className="spacer" />
          {NEXT[s.status].map((action) => (
            <button
              key={action.status}
              type="button"
              className={`btn btn-sm ${action.status === 'CANCELLED' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setNext(action.status)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <dl className="form-grid">
          <div>
            <dt className="muted">Vendido</dt>
            <dd>{formatMoney(s.grossSalesAmount.amount)}</dd>
          </div>
          <div>
            <dt className="muted">Comissão do time</dt>
            <dd>{formatMoney(s.commissionAmount.amount)}</dd>
          </div>
          <div>
            <dt className="muted">Ajuste</dt>
            <dd>
              {formatMoney(s.adjustmentAmount.amount)}
              {s.adjustmentReason ? <small className="muted"> — {s.adjustmentReason}</small> : null}
            </dd>
          </div>
          <div>
            <dt className="muted">Líquido a repassar</dt>
            <dd>
              <strong>{formatMoney(s.netPayableAmount.amount)}</strong>
            </dd>
          </div>
        </dl>
        {s.cancellationReason ? (
          <Alert kind="warning">Cancelado: {s.cancellationReason}</Alert>
        ) : null}
        {s.transactionId && can('finance.read') ? (
          <p>
            Saída lançada no Caixa. <Link href="/admin/caixa">Ver no Caixa Fênix</Link>
          </p>
        ) : null}
      </section>

      {s.status === 'APPROVED' ? (
        <form className="form card" onSubmit={(event) => void pay.submit(event)}>
          <h2>Registrar pagamento ao parceiro</h2>
          <p className="muted">
            Lança uma saída confirmada de {formatMoney(s.netPayableAmount.amount)} na conta
            escolhida, categoria “Repasses a parceiros”.
          </p>
          <ErrorSummary error={pay.error} />
          <div className="form-grid">
            <AccountSelect
              label="Conta de saída"
              value={payment.accountId}
              onChange={(accountId) => setPayment({ ...payment, accountId })}
            />
            <MethodSelect
              required={false}
              value={payment.paymentMethodId}
              onChange={(paymentMethodId) => setPayment({ ...payment, paymentMethodId })}
            />
            <TextField
              label="Data do pagamento"
              type="date"
              required
              value={payment.paidOn}
              onChange={(e) => setPayment({ ...payment, paidOn: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={pay.pending}>
              Registrar pagamento
            </button>
          </div>
        </form>
      ) : null}

      <section className="card stack" aria-labelledby="itens">
        <h2 id="itens">Itens ({s.itemCount})</h2>
        {s.items && s.items.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Produto</th>
                  <th scope="col">Pago em</th>
                  <th scope="col" className="num">
                    Bruto
                  </th>
                  <th scope="col" className="num">
                    Comissão
                  </th>
                  <th scope="col" className="num">
                    Parceiro
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Pedido">
                      <Link href={`/admin/pedidos/${item.orderId}`}>{item.orderNumber}</Link>
                    </td>
                    <td data-label="Produto">
                      {item.quantity}× {item.productName}
                    </td>
                    <td data-label="Pago em">{formatDateTime(item.paidAt)}</td>
                    <td data-label="Bruto" className="num">
                      {formatMoney(item.gross.amount)}
                    </td>
                    <td data-label="Comissão" className="num">
                      {formatMoney(item.commission.amount)}
                    </td>
                    <td data-label="Parceiro" className="num">
                      {formatMoney(item.net.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Sem itens (repasse cancelado libera os itens para outro repasse).</p>
        )}
      </section>

      <ConfirmDialog
        open={next !== null}
        title={next ? `Repasse: ${SETTLEMENT_STATUS[next].label}` : ''}
        description={
          next === 'CANCELLED'
            ? 'Os itens voltam a ficar disponíveis para outro repasse. Nenhum valor foi lançado no Caixa.'
            : undefined
        }
        confirmLabel="Confirmar"
        danger={next === 'CANCELLED'}
        requireReason={next === 'CANCELLED'}
        onClose={() => setNext(null)}
        onConfirm={async (reason) => {
          settlement.setData(
            await api<Settlement>(`/settlements/${id}/status`, {
              method: 'PUT',
              body: { status: next, ...(reason ? { reason } : {}) }
            })
          );
        }}
      />
    </>
  );
}
