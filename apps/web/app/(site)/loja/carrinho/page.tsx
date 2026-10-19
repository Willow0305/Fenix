'use client';

import Link from 'next/link';
import { useState } from 'react';

import { OrderPayment } from '../../../../components/payment-instructions';
import { OrderSummary } from '../../../../components/order-summary';
import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { useCart } from '../../../../lib/cart-context';
import { formatMoney } from '../../../../lib/format';
import type { Order } from '../../../../lib/store-types';

export default function CartPage() {
  const { status, profile } = useAuth();
  const { cart, setQuantity, reload } = useCart();
  const [lineError, setLineError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: ''
  });
  const [accept, setAccept] = useState(false);
  const [result, setResult] = useState<{ order: Order; guestAccessCode: string | null } | null>(
    null
  );
  const checkout = useSubmit(async () => {
    const authenticated = status === 'authenticated';
    const created = await api<{ order: Order; guestAccessCode: string | null }>(
      '/orders/checkout',
      {
        method: 'POST',
        body: {
          acceptTerms: accept,
          ...(authenticated
            ? {}
            : { customerName: form.customerName, customerEmail: form.customerEmail }),
          ...(form.customerPhone ? { customerPhone: form.customerPhone } : {}),
          ...(form.notes ? { notes: form.notes } : {})
        }
      }
    );

    setResult(created);
    await reload();
  });

  async function change(variantId: string, quantity: number) {
    setLineError(null);

    try {
      await setQuantity(variantId, quantity);
    } catch (error) {
      setLineError(errorMessage(error));
    }
  }

  if (result) {
    const { order, guestAccessCode } = result;

    return (
      <div className="container stack" style={{ paddingTop: '2rem', maxWidth: 860 }}>
        <PageHeader
          title="Pedido realizado!"
          description="Enviamos os detalhes para o seu e-mail."
        />
        {guestAccessCode ? (
          <Alert kind="warning">
            Guarde o código de acesso <strong>{guestAccessCode}</strong>. Ele e o número{' '}
            <strong>{order.orderNumber}</strong> são necessários para consultar o pedido em{' '}
            <Link href="/loja/pedido">Consultar pedido</Link>.
          </Alert>
        ) : (
          <Alert kind="info">
            Acompanhe em <Link href={`/minha-conta/pedidos/${order.id}`}>Meus pedidos</Link>.
          </Alert>
        )}
        <OrderSummary order={order} />
        <OrderPayment
          order={order}
          endpoint={guestAccessCode ? '/public/orders/proof' : `/me/orders/${order.id}/proof`}
          extraFields={
            guestAccessCode ? { orderNumber: order.orderNumber, code: guestAccessCode } : {}
          }
          onDone={(updated) => setResult({ order: updated, guestAccessCode })}
        />
      </div>
    );
  }

  return (
    <div className="container stack" style={{ paddingTop: '2rem', maxWidth: 960 }}>
      <PageHeader title="Carrinho" actions={<Link href="/loja">Continuar comprando</Link>} />
      {cart === null ? <Loading /> : null}
      {cart && cart.lines.length === 0 ? (
        <Empty>
          Seu carrinho está vazio. <Link href="/loja">Ir para a loja</Link>
        </Empty>
      ) : null}
      {lineError ? <Alert kind="error">{lineError}</Alert> : null}
      {cart && cart.lines.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Quantidade</th>
                  <th scope="col" className="num">
                    Unitário
                  </th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Remover</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <Link href={`/loja/${line.productSlug}`}>{line.productName}</Link>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {line.variantName}
                        {line.campaign ? ` · pré-venda ${line.campaign.name}` : ''}
                      </div>
                      {line.warning === 'UNAVAILABLE' ? (
                        <span className="field-error">Indisponível — remova para continuar.</span>
                      ) : null}
                      {line.warning === 'INSUFFICIENT_STOCK' ? (
                        <span className="field-error">Só há {line.available} disponível(is).</span>
                      ) : null}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        aria-label={`Quantidade de ${line.productName}`}
                        defaultValue={line.quantity}
                        onBlur={(e) => {
                          const value = Number(e.target.value);

                          if (value !== line.quantity && value > 0) {
                            void change(line.variantId, value);
                          }
                        }}
                        style={{ width: 70, minHeight: 36 }}
                      />
                    </td>
                    <td className="num">{formatMoney(line.unitPrice.amount)}</td>
                    <td className="num">{formatMoney(line.lineTotal.amount)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => void change(line.variantId, 0)}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ textAlign: 'right', fontSize: '1.3rem' }}>
            Total: <strong>{formatMoney(cart.total.amount)}</strong>
          </p>

          <form className="form card" onSubmit={(event) => void checkout.submit(event)}>
            <h2>Finalizar pedido</h2>
            <p className="muted">
              Retirada combinada com o time. O pagamento é feito por PIX após a confirmação do
              pedido.
            </p>
            <ErrorSummary error={checkout.error} />
            {status === 'authenticated' && profile ? (
              <p>
                Pedido em nome de <strong>{profile.name}</strong> ({profile.email}).
              </p>
            ) : (
              <>
                <p className="muted">
                  Comprando sem conta. <Link href="/entrar?next=/loja/carrinho">Entre</Link> para
                  acompanhar pela sua área.
                </p>
                <div className="form-grid">
                  <TextField
                    label="Nome completo"
                    required
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    error={checkout.fieldError('customerName')}
                  />
                  <TextField
                    label="E-mail"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    error={checkout.fieldError('customerEmail')}
                  />
                </div>
              </>
            )}
            <TextField
              label="Telefone/WhatsApp"
              type="tel"
              required={status !== 'authenticated' || !profile?.phone}
              autoComplete="tel"
              value={form.customerPhone}
              placeholder={profile?.phone ?? ''}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              error={checkout.fieldError('customerPhone')}
            />
            <TextArea
              label="Observações (opcional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
              />
              <span>
                Concordo com as <Link href="/termos">regras da loja e termos</Link> e com o uso dos
                meus dados para processar o pedido.
              </span>
            </label>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={checkout.pending || cart.hasWarnings}
              >
                {checkout.pending
                  ? 'Enviando…'
                  : `Confirmar pedido · ${formatMoney(cart.total.amount)}`}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
