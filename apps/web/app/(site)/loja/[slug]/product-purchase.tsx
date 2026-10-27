'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '../../../../components/icon';
import { QuantityStepper } from '../../../../components/quantity-stepper';
import {
  AttributePicker,
  hasAttributes,
  PersonalizationInputs
} from '../../../../components/variant-attributes';
import { Alert, ErrorSummary, useSubmit } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { useCart } from '../../../../lib/cart-context';
import { formatMoney } from '../../../../lib/format';
import type { ProductDetail } from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';

/** Escolha de variação/quantidade e favoritos; o servidor revalida tudo (RN-LOJ-007). */
export function ProductPurchase({ product }: { readonly product: ProductDetail }) {
  const { status } = useAuth();
  const { cart, setQuantity } = useCart();
  const active = product.variants.filter((variant) => variant.isActive);
  const [variantId, setVariantId] = useState(
    active.find((v) => v.inStock)?.id ?? active[0]?.id ?? ''
  );
  const [quantity, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const favorites = useResource<{ productId: string }[]>(
    status === 'authenticated' ? '/me/favorites' : null
  );
  const isFavorite = favorites.data?.some((f) => f.productId === product.id) ?? false;
  const variant = active.find((v) => v.id === variantId);
  const fields = product.personalizationFields;
  const [values, setValues] = useState<Record<string, string>>({});
  // Personalização: cada combinação é uma linha; compara como o servidor guarda (DT-069).
  const normalized = (input: Record<string, string>) =>
    JSON.stringify(
      fields
        .map((f) => [f.id, (input[f.id] ?? '').trim().replace(/\s+/g, ' ').toUpperCase()])
        .filter(([, v]) => v !== '')
    );
  const inCart =
    cart?.lines.find(
      (line) =>
        line.variantId === variantId &&
        (fields.length === 0 || normalized(line.personalizationValues) === normalized(values))
    )?.quantity ?? 0;
  const extras = fields
    .filter((f) => (values[f.id] ?? '').trim() !== '')
    .reduce((total, f) => total + Number(f.extraPrice.amount), 0);
  const add = useSubmit(async () => {
    await setQuantity(variantId, inCart + quantity, fields.length > 0 ? values : undefined);
    setAdded(true);
  });

  async function toggleFavorite() {
    await api(`/me/favorites/${product.id}`, { method: isFavorite ? 'DELETE' : 'PUT' });
    await favorites.reload();
  }

  return (
    <div className="card stack">
      <div className="row">
        <strong style={{ fontSize: '1.6rem', color: 'var(--color-primary-dark)' }}>
          {formatMoney(
            (Number(variant?.price.amount ?? product.priceFrom.amount) + extras).toFixed(2)
          )}
        </strong>
        {variant && variant.price.amount !== variant.listPrice.amount ? (
          <s className="muted">{formatMoney(variant.listPrice.amount)}</s>
        ) : null}
      </div>
      {hasAttributes(active) ? (
        <AttributePicker
          variants={active}
          value={variantId}
          onChange={(id) => {
            setVariantId(id);
            setAdded(false);
            setQty(1);
          }}
        />
      ) : active.length > 1 ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Opção</legend>
          <div className="row">
            {active.map((v) => (
              <label
                key={v.id}
                className={`btn btn-sm ${v.id === variantId ? 'btn-primary' : 'btn-secondary'}`}
                style={{ opacity: v.inStock ? 1 : 0.5 }}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  checked={v.id === variantId}
                  onChange={() => {
                    setVariantId(v.id);
                    setAdded(false);
                    setQty(1);
                  }}
                  className="visually-hidden"
                />
                {v.name}
                {v.inStock ? '' : ' (esgotado)'}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {variant?.lowStock ? (
        <span className="badge badge-warning">
          <Icon name="hourglass-split" /> Últimas unidades
        </span>
      ) : null}
      {product.sizeGuide ? (
        <details className="collapsible">
          <summary>Guia de medidas</summary>
          <p className="prose" style={{ margin: 0 }}>
            {product.sizeGuide}
          </p>
        </details>
      ) : null}
      {fields.length > 0 ? (
        <>
          <PersonalizationInputs fields={fields} values={values} onChange={setValues} />
          <small className="muted">
            Item personalizado: não tem troca ou devolução por arrependimento, mas tem garantia
            contra defeito.
          </small>
        </>
      ) : null}
      {product.fulfillmentType === 'MEMBERSHIP' && status === 'anonymous' ? (
        <Alert kind="info">
          <Link href={`/entrar?next=/loja/${product.slug}`}>Entre na sua conta</Link> para comprar:
          as carteirinhas ficam nela.
        </Alert>
      ) : product.purchasable && variant?.inStock ? (
        <form className="row" onSubmit={(event) => void add.submit(event)}>
          <QuantityStepper
            label={`Quantidade de ${product.name}`}
            value={quantity}
            max={Math.max(1, (product.buyerLimit ?? 50) - inCart)}
            onChange={setQty}
          />
          <button type="submit" className="btn btn-primary" disabled={add.pending || !variantId}>
            <Icon name="cart-plus" /> {add.pending ? 'Adicionando…' : 'Adicionar ao carrinho'}
          </button>
        </form>
      ) : (
        <Alert kind="info">
          {product.purchasable
            ? 'Opção esgotada no momento.'
            : 'Produto indisponível para compra no momento.'}
        </Alert>
      )}
      {product.buyerLimit ? (
        <small className="muted">Limite de {product.buyerLimit} unidade(s) por comprador.</small>
      ) : null}
      <ErrorSummary error={add.error} />
      {added ? (
        <Alert kind="success">
          Adicionado ao carrinho. <Link href="/loja/carrinho">Ver carrinho e finalizar</Link>
        </Alert>
      ) : null}
      {status === 'authenticated' ? (
        <button
          type="button"
          className="btn btn-link"
          onClick={() => void toggleFavorite()}
          aria-pressed={isFavorite}
        >
          {isFavorite ? '♥ Remover dos favoritos' : '♡ Salvar nos favoritos'}
        </button>
      ) : null}
    </div>
  );
}
