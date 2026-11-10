'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { AccountSelect, MethodSelect } from '../../../../components/finance-pickers';
import { OrderSummary } from '../../../../components/order-summary';
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
import type { Payment } from '../../../../lib/finance-types';
import { formatPhoneDisplay, todayCivil } from '../../../../lib/format';
import { useIdempotencyKey } from '../../../../lib/idempotency';
import { orderNext, ORDER_STATUS, type Order, type OrderStatus } from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';
import { ContactActions } from '../../../../components/contact-actions';
import { Icon } from '../../../../components/icon';
import { DeliveryProof } from '../../../../components/delivery-proof';
import { DispatchPanel } from '../../../../components/dispatch-panel';

export default function OrderAdminPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const order = useResource<Order>(`/store/orders/${id}`);
  const idem = useIdempotencyKey();
  const [notice, setNotice] = useState<string | null>(null);
  const [payment, setPayment] = useState({
    paymentMethodId: '',
    paidOn: todayCivil(),
    accountId: ''
  });
  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [confirmAccount, setConfirmAccount] = useState('');
  const [nextStatus, setNextStatus] = useState<OrderStatus | null>(null);
  const [restock, setRestock] = useState(true);
  const record = useSubmit(async () => {
    order.setData(
      await api<Order>(`/store/orders/${id}/payments`, {
        method: 'POST',
        headers: idem.headers(),
        body: {
          paymentMethodId: payment.paymentMethodId,
          paidOn: payment.paidOn,
          ...(payment.accountId ? { accountId: payment.accountId } : {})
        }
      })
    );
    idem.rotate();
    setNotice(
      payment.accountId
        ? 'Pagamento confirmado e lançado no Caixa.'
        : 'Pagamento registrado, aguardando confirmação.'
    );
  });

  if (!order.data) {
    return order.error ? <Alert kind="error">{order.error}</Alert> : <Loading />;
  }

  const o = order.data;
  const needsReason = nextStatus === 'CANCELLED' || nextStatus === 'REFUNDED';

  return (
    <>
      <PageHeader
        title={`Pedido ${o.orderNumber}`}
        description={`${o.customerName} · ${o.customerEmail ?? ''} · ${o.customerPhone ? formatPhoneDisplay(o.customerPhone) : ''}`}
        actions={
          <>
            <ContactActions
              phone={o.customerPhone}
              email={o.customerEmail}
              who="cliente"
              subject={`Pedido ${o.orderNumber} — Fênix Vôlei`}
            />
            <Link href="/admin/pedidos">
              <Icon name="arrow-left" /> Voltar
            </Link>
          </>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <OrderSummary order={o} />
      {o.cardHolder ? <CardHolderNotice holder={o.cardHolder} buyer={o.customerName} /> : null}
      <DispatchPanel order={o} onChanged={order.reload} />
      <DeliveryProof order={o} onChanged={order.reload} />
      {o.notes ? <Alert kind="info">Observação do cliente: {o.notes}</Alert> : null}

      {o.payments.some((p) => p.status === 'PENDING' || p.attachments.length > 0) ? (
        <section className="card stack">
          <h2>Comprovantes</h2>
          {o.payments.map((p) => (
            <div key={p.id} className="row">
              {p.attachments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="btn btn-link"
                  onClick={() =>
                    void openProtectedFile(
                      `/store/orders/${id}/payments/${p.id}/attachments/${a.id}`
                    )
                  }
                >
                  Ver comprovante ({a.fileName})
                </button>
              ))}
              {p.status === 'PENDING' && can('payments.confirm') ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setConfirming(p)}
                >
                  Confirmar pagamento
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {o.status === 'AWAITING_PAYMENT' &&
      o.pendingAmount.amount === '0.00' &&
      can('payments.record') ? (
        <form className="form card" onSubmit={(event) => void record.submit(event)}>
          <h2>Registrar pagamento recebido</h2>
          <ErrorSummary error={record.error} />
          <div className="form-grid">
            <MethodSelect
              value={payment.paymentMethodId}
              onChange={(v) => setPayment({ ...payment, paymentMethodId: v })}
            />
            <TextField
              label="Data"
              type="date"
              value={payment.paidOn}
              onChange={(e) => setPayment({ ...payment, paidOn: e.target.value })}
            />
            {can('payments.confirm') ? (
              <AccountSelect
                label="Confirmar na conta (opcional)"
                required={false}
                allowEmpty={false}
                value={payment.accountId}
                onChange={(v) => setPayment({ ...payment, accountId: v })}
              />
            ) : null}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={record.pending}>
              Registrar pagamento do total
            </button>
          </div>
        </form>
      ) : null}

      {can('orders.status.change') && orderNext(o).length > 0 ? (
        <section className="card row">
          <strong>Avançar pedido:</strong>
          {orderNext(o).map((status) => (
            <button
              key={status}
              type="button"
              className={`btn btn-sm ${status === 'CANCELLED' || status === 'REFUNDED' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setNextStatus(status)}
            >
              {ORDER_STATUS[status].label}
            </button>
          ))}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title="Confirmar pagamento"
        description="O pedido passa a Pago, o estoque reservado vira saída e a entrada é lançada no Caixa."
        confirmLabel="Confirmar"
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          order.setData(
            await api<Order>(`/store/orders/${id}/payments/${confirming?.id ?? ''}/confirm`, {
              method: 'POST',
              body: { accountId: confirmAccount }
            })
          );
          setNotice('Pagamento confirmado.');
        }}
      >
        <AccountSelect value={confirmAccount} onChange={setConfirmAccount} />
      </ConfirmDialog>
      <ConfirmDialog
        open={nextStatus !== null}
        title={`Pedido: ${nextStatus ? ORDER_STATUS[nextStatus].label : ''}`}
        description={
          needsReason
            ? 'Pagamentos confirmados serão estornados com saída vinculada no Caixa; reservas são liberadas.'
            : 'O cliente com conta será notificado.'
        }
        confirmLabel="Confirmar"
        danger={needsReason}
        requireReason={needsReason}
        onClose={() => setNextStatus(null)}
        onConfirm={async (reason) => {
          order.setData(
            await api<Order>(`/store/orders/${id}/status`, {
              method: 'PUT',
              body: {
                status: nextStatus,
                ...(reason ? { reason } : {}),
                ...(needsReason ? { restock } : {})
              }
            })
          );
          setNotice('Pedido atualizado.');
        }}
      >
        {needsReason ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
            />
            <span>Devolver itens ao estoque</span>
          </label>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/** Normaliza para comparar nomes sem acento, caixa ou espaços extras. */
function sameName(a: string, b: string): boolean {
  const clean = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  return clean(a) === clean(b);
}

/**
 * Titular do cartão pago pelo site (DT-100). Quando o nome do cartão não bate com o de quem
 * comprou, a diretoria confere o documento na retirada ou na entrega.
 */
function CardHolderNotice({
  holder,
  buyer
}: {
  readonly holder: NonNullable<Order['cardHolder']>;
  readonly buyer: string;
}) {
  const card = [holder.brand?.toUpperCase(), holder.lastFour ? `final ${holder.lastFour}` : null]
    .filter(Boolean)
    .join(' ');
  const differs = holder.name !== null && !sameName(holder.name, buyer);

  return (
    <Alert kind={differs ? 'warning' : 'info'}>
      Pago com o cartão {card ? `${card} ` : ''}de{' '}
      <strong>{holder.name ?? 'titular não informado pelo Mercado Pago'}</strong>
      {holder.document ? ` (CPF/CNPJ ${holder.document})` : ''}.
      {differs
        ? ' O nome do cartão é diferente do de quem comprou: confira o documento na retirada ou na entrega.'
        : ''}
    </Alert>
  );
}
