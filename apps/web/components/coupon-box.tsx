'use client';

import { useEffect, useRef, useState } from 'react';

import { api, ApiError, errorMessage } from '../lib/api-client';
import { formatMoney } from '../lib/format';
import type { CouponPreview } from '../lib/store-types';
import { Icon } from './icon';

/**
 * Cupom no carrinho (DT-045): aplica, mostra o desconto e refaz a prévia quando o
 * carrinho muda. A prévia não reserva o cupom; o fechamento do pedido confere de novo.
 */
export function CouponBox({
  cartTotal,
  applied,
  onChange
}: {
  /** Valor do carrinho; muda quando itens ou quantidades mudam. */
  readonly cartTotal: string;
  readonly applied: CouponPreview | null;
  readonly onChange: (preview: CouponPreview | null) => void;
}) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTotal = useRef(cartTotal);

  async function apply(value: string, silent = false) {
    setPending(true);
    setError(null);

    try {
      onChange(await api<CouponPreview>('/cart/coupon', { method: 'POST', body: { code: value } }));
    } catch (caught) {
      onChange(null);

      const message =
        caught instanceof ApiError
          ? (caught.problem.errors?.[0]?.message ?? caught.problem.detail)
          : errorMessage(caught);

      setError(silent ? `O cupom deixou de valer: ${message}` : message);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (applied && lastTotal.current !== cartTotal) {
      void apply(applied.code, true);
    }

    lastTotal.current = cartTotal;
    // Só o total do carrinho dispara a nova prévia.
  }, [cartTotal]);

  if (applied) {
    return (
      <div className="alert alert-success row" role="status">
        <span style={{ flex: '1 1 14rem' }}>
          <Icon name="ticket-perforated" /> Cupom <strong>{applied.code}</strong>: −
          {formatMoney(applied.discount.amount)}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            onChange(null);
            setCode('');
          }}
        >
          Remover cupom
        </button>
      </div>
    );
  }

  return (
    <form
      className="row filter-bar"
      onSubmit={(event) => {
        event.preventDefault();

        if (code.trim()) {
          void apply(code.trim());
        }
      }}
    >
      <label className="field">
        <span className="label">Cupom de desconto</span>
        <input
          value={code}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="characters"
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Ex.: FENIX10"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
        />
        {error ? (
          <span id="coupon-error" className="field-error">
            {error}
          </span>
        ) : null}
      </label>
      <div className="form-actions">
        <button type="submit" className="btn btn-secondary" disabled={pending || !code.trim()}>
          <Icon name="ticket-perforated" /> {pending ? 'Conferindo…' : 'Aplicar'}
        </button>
      </div>
    </form>
  );
}
