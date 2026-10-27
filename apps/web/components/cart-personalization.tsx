'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import type { Cart, CartLine } from '../lib/store-types';
import { ErrorSummary, useSubmit } from './ui';
import { PersonalizationInputs } from './variant-attributes';

/**
 * Personalização de uma linha do carrinho (DT-069): mostra o escolhido e permite editar
 * até fechar o pedido. Se ficar igual a outra linha, as duas se juntam.
 */
export function CartPersonalization({
  line,
  onSaved
}: {
  readonly line: CartLine;
  readonly onSaved: (cart: Cart) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(line.personalizationValues);
  const save = useSubmit(async () => {
    onSaved(
      await api<Cart>(`/cart/items/${line.id}/personalization`, {
        method: 'PUT',
        body: { values }
      })
    );
    setEditing(false);
  });

  if (!editing) {
    return (
      <div className="row" style={{ gap: '0.4rem' }}>
        <small>
          {line.personalization.length > 0
            ? line.personalization.map((p) => `${p.label}: ${p.value}`).join(' · ')
            : 'Sem personalização'}
        </small>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => {
            setValues(line.personalizationValues);
            setEditing(true);
          }}
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={(event) => void save.submit(event)}>
      <ErrorSummary error={save.error} />
      <PersonalizationInputs
        fields={line.personalizationFields.map((field) => ({
          ...field,
          extraPrice: { amount: field.extraPrice, currency: 'BRL' },
          sortOrder: 0,
          isActive: true
        }))}
        values={values}
        onChange={setValues}
      />
      <div className="row">
        <button type="submit" className="btn btn-secondary btn-sm" disabled={save.pending}>
          Salvar personalização
        </button>
        <button type="button" className="btn btn-link" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
