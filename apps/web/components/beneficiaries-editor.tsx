'use client';

import { useEffect, useState } from 'react';

import { api } from '../lib/api-client';
import type { MyCards } from '../lib/card-types';
import type { Beneficiary, Cart, CartLine } from '../lib/store-types';
import { useResource } from '../lib/use-resource';
import { ErrorSummary, useSubmit } from './ui';

/**
 * Beneficiários de uma afiliação no carrinho (DT-068): um por unidade, com nome completo,
 * e-mail opcional (a carteirinha vai para a conta com esse e-mail) ou a renovação de uma
 * carteirinha de afiliado já existente.
 */
export function BeneficiariesEditor({
  line,
  onSaved
}: {
  readonly line: CartLine;
  readonly onSaved: (cart: Cart) => void;
}) {
  const initial = line.beneficiaries ?? [];
  const [rows, setRows] = useState<Beneficiary[]>(initial);
  const mine = useResource<MyCards>('/me/cards');
  const renewable = (mine.data?.cards ?? []).filter(
    (card) => card.type === 'AFFILIATE' && card.state !== 'CANCELLED'
  );
  const save = useSubmit(async () => {
    onSaved(
      await api<Cart>(`/cart/items/${line.id}/beneficiaries`, {
        method: 'PUT',
        body: {
          beneficiaries: rows.map((row) => ({
            name: row.name,
            email: row.email ?? '',
            ...(row.cardId ? { cardId: row.cardId } : {})
          }))
        }
      })
    );
    save.setMessage('Beneficiários salvos.');
  });

  // A quantidade mudou no carrinho: a lista acompanha a do servidor.
  useEffect(() => setRows(line.beneficiaries ?? []), [line.beneficiaries]);

  const update = (index: number, patch: Partial<Beneficiary>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form className="stack beneficiaries" onSubmit={(event) => void save.submit(event)}>
      <strong>
        Beneficiários ({rows.length}) · válida por {line.membershipMonths ?? 12} meses
      </strong>
      <small className="muted">
        Uma carteirinha por pessoa, de uso pessoal e intransferível. Com o e-mail, ela aparece na
        conta da pessoa; sem e-mail, fica em Minha conta → Carteirinhas, para você mostrar ou
        imprimir.
      </small>
      <ErrorSummary error={save.error} />
      {rows.map((row, index) => (
        <fieldset key={index} className="form-section">
          <legend>Beneficiário {index + 1}</legend>
          {renewable.length > 0 ? (
            <label className="field">
              <span className="label">Nova ou renovação</span>
              <select
                value={row.cardId ?? ''}
                onChange={(e) => {
                  const card = renewable.find((c) => c.id === e.target.value);

                  update(index, {
                    cardId: card?.id ?? null,
                    ...(card ? { name: card.holderName } : {})
                  });
                }}
              >
                <option value="">Carteirinha nova</option>
                {renewable.map((card) => (
                  <option key={card.id} value={card.id}>
                    Renovar a de {card.holderName} ({card.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span className="label">Nome completo</span>
            <input
              maxLength={160}
              required
              disabled={row.cardId !== null}
              value={row.name}
              onChange={(e) => update(index, { name: e.target.value })}
              autoComplete="off"
            />
          </label>
          {row.cardId === null ? (
            <label className="field">
              <span className="label">E-mail (opcional)</span>
              <input
                type="email"
                maxLength={180}
                value={row.email ?? ''}
                onChange={(e) => update(index, { email: e.target.value || null })}
                autoComplete="off"
              />
            </label>
          ) : null}
        </fieldset>
      ))}
      {save.message ? <p className="muted">{save.message}</p> : null}
      <div>
        <button type="submit" className="btn btn-secondary btn-sm" disabled={save.pending}>
          Salvar beneficiários
        </button>
      </div>
    </form>
  );
}
