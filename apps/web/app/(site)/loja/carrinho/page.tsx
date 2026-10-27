'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '../../../../components/icon';
import { LiveRefresh } from '../../../../components/live-refresh';
import { MediaImage } from '../../../../components/media-image';
import { OrderPayment } from '../../../../components/payment-instructions';
import { QuantityStepper } from '../../../../components/quantity-stepper';
import { OrderSummary } from '../../../../components/order-summary';
import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  PhoneField,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { useCart } from '../../../../lib/cart-context';
import { formatMoney, formatPhoneDisplay } from '../../../../lib/format';
import type { CouponPreview, Order } from '../../../../lib/store-types';
import { BeneficiariesEditor } from '../../../../components/beneficiaries-editor';
import { CartPersonalization } from '../../../../components/cart-personalization';
import { CouponBox } from '../../../../components/coupon-box';

export default function CartPage() {
  const { status, profile } = useAuth();
  const { cart, setQuantity, changeOption, reload } = useCart();
  const [lineError, setLineError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: ''
  });
  const [accept, setAccept] = useState(false);
  const [acceptPersonalized, setAcceptPersonalized] = useState(false);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
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
          ...(acceptPersonalized ? { acceptPersonalized: true } : {}),
          ...(authenticated
            ? {}
            : { customerName: form.customerName, customerEmail: form.customerEmail }),
          ...(form.customerPhone ? { customerPhone: form.customerPhone } : {}),
          ...(form.notes ? { notes: form.notes } : {}),
          ...(coupon ? { couponCode: coupon.code } : {})
        }
      }
    );

    setResult(created);
    await reload();
  });

  async function run(action: () => Promise<unknown>) {
    setLineError(null);

    try {
      await action();
    } catch (error) {
      setLineError(errorMessage(error));
      await reload();
    }
  }

  // Linha personalizada é identificada também pela personalização (DT-069).
  const change = (
    line: { variantId: string; personalizationValues: Record<string, string> },
    quantity: number
  ) =>
    run(() =>
      setQuantity(
        line.variantId,
        quantity,
        Object.keys(line.personalizationValues).length > 0 ? line.personalizationValues : undefined
      )
    );

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
      <LiveRefresh topics={['store']} onChange={() => void reload()} />
      <PageHeader
        title="Carrinho"
        {...(cart && cart.itemCount > 0
          ? { description: `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'itens'}` }
          : {})}
        actions={
          <Link href="/loja">
            <Icon name="arrow-left" /> Continuar comprando
          </Link>
        }
      />
      {cart === null ? <Loading /> : null}
      {cart && cart.lines.length === 0 ? (
        <Empty>
          Seu carrinho está vazio. <Link href="/loja">Ir para a loja</Link>
        </Empty>
      ) : null}
      {lineError ? <Alert kind="error">{lineError}</Alert> : null}
      {cart && cart.lines.length > 0 ? (
        <>
          <ul className="cart-lines">
            {cart.lines.map((line) => {
              const choices = line.options.filter(
                (option) => option.variantId === line.variantId || option.available !== 0
              );

              return (
                <li key={line.id} className="cart-line">
                  <Link href={`/loja/${line.productSlug}`} className="cart-thumb" tabIndex={-1}>
                    <MediaImage src={line.image} alt="" ratio="1/1" fit="contain" />
                  </Link>
                  <div className="cart-line-body">
                    <Link href={`/loja/${line.productSlug}`} className="cart-line-name">
                      {line.productName}
                    </Link>
                    {line.campaign ? (
                      <small className="muted">Pré-venda · {line.campaign.name}</small>
                    ) : null}
                    {choices.length > 1 ? (
                      <label className="cart-option">
                        <span className="muted">Opção</span>
                        <select
                          value={line.variantId}
                          aria-label={`Opção de ${line.productName}`}
                          onChange={(event) =>
                            void run(() =>
                              changeOption(
                                line.variantId,
                                event.target.value,
                                line.quantity,
                                line.isPersonalized ? line.personalizationValues : undefined
                              )
                            )
                          }
                        >
                          {choices.map((option) => (
                            <option key={option.variantId} value={option.variantId}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <small className="muted">{line.variantName}</small>
                    )}
                    {line.warning === 'UNAVAILABLE' ? (
                      <span className="field-error">Indisponível — remova para continuar.</span>
                    ) : null}
                    {line.warning === 'BENEFICIARIES_REQUIRED' ? (
                      <span className="field-error">
                        Informe o nome completo de cada beneficiário e salve.
                      </span>
                    ) : null}
                    {line.isPersonalized ? (
                      <CartPersonalization line={line} onSaved={() => void reload()} />
                    ) : null}
                    {line.fulfillmentType === 'MEMBERSHIP' ? (
                      <BeneficiariesEditor line={line} onSaved={() => void reload()} />
                    ) : null}
                    {line.warning === 'INSUFFICIENT_STOCK' ? (
                      <span className="field-error">
                        Só há {line.available} disponível(is). Ajuste a quantidade.
                      </span>
                    ) : null}
                    <div className="cart-line-actions">
                      <QuantityStepper
                        label={`Quantidade de ${line.productName}`}
                        value={line.quantity}
                        max={Math.min(50, line.available ?? 50) || line.quantity}
                        onChange={(value) => void change(line, value)}
                      />
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => void change(line, 0)}
                      >
                        <Icon name="trash3" /> Remover
                      </button>
                    </div>
                  </div>
                  <div className="cart-line-price">
                    <strong>{formatMoney(line.lineTotal.amount)}</strong>
                    {line.quantity > 1 ? (
                      <small className="muted">{formatMoney(line.unitPrice.amount)} cada</small>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <CouponBox cartTotal={cart.total.amount} applied={coupon} onChange={setCoupon} />
          <div className="cart-totals">
            {coupon ? (
              <>
                <span>Subtotal</span>
                <span>{formatMoney(coupon.subtotal.amount)}</span>
                <span>Desconto ({coupon.code})</span>
                <span>−{formatMoney(coupon.discount.amount)}</span>
              </>
            ) : null}
            <strong>Total</strong>
            <strong>{formatMoney((coupon?.total ?? cart.total).amount)}</strong>
          </div>

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
                    maxLength={160}
                    required
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    error={checkout.fieldError('customerName')}
                  />
                  <TextField
                    label="E-mail"
                    maxLength={180}
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
            <PhoneField
              label="Celular/WhatsApp"
              required={status !== 'authenticated' || !profile?.phone}
              value={form.customerPhone}
              placeholder={profile?.phone ? formatPhoneDisplay(profile.phone) : '(00) 00000-0000'}
              onValueChange={(value) => setForm({ ...form, customerPhone: value })}
              error={checkout.fieldError('customerPhone')}
            />
            <TextArea
              label="Observações (opcional)"
              maxLength={2000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            {cart.lines.some((line) => line.isPersonalized) ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={acceptPersonalized}
                  onChange={(e) => setAcceptPersonalized(e.target.checked)}
                  required
                />
                <span>
                  Estou ciente: item personalizado não tem troca ou devolução por arrependimento
                  (continua com garantia contra defeito).
                </span>
              </label>
            ) : null}
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
                  : `Confirmar pedido · ${formatMoney((coupon?.total ?? cart.total).amount)}`}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
