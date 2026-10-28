'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import type { AddressForm, DeliveryOptions } from '../lib/delivery-types';
import { formatMoney } from '../lib/format';
import { PhoneField, PostalCodeField, TextField } from './ui';

interface PostalLookup {
  street: string;
  neighborhood: string;
  city: string;
  neighborhoodId: string | null;
}

/**
 * Campos do endereço de entrega (DT-075). O CEP preenche a rua e, se o bairro for atendido,
 * já o escolhe; o bairro sempre sai da lista de bairros atendidos.
 */
export function AddressFields({
  options,
  value,
  onChange,
  fieldError
}: {
  readonly options: DeliveryOptions;
  readonly value: AddressForm;
  readonly onChange: (next: AddressForm) => void;
  readonly fieldError?: (field: string) => string | undefined;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const set = (key: keyof AddressForm) => (event: { target: { value: string } }) =>
    onChange({ ...value, [key]: event.target.value });
  const error = (field: string) => fieldError?.(`address.${field}`) ?? fieldError?.(field);

  async function lookup(postalCode: string) {
    setNotice(null);

    if (postalCode.length !== 8) {
      return;
    }

    try {
      const found = (
        await api<{ address: PostalLookup | null }>(`/public/postal-codes/${postalCode}`)
      ).address;

      if (!found || !found.street) {
        setNotice('CEP não encontrado: preencha a rua e escolha o bairro.');

        return;
      }

      onChange({
        ...value,
        postalCode,
        street: found.street,
        neighborhoodId: found.neighborhoodId ?? value.neighborhoodId
      });

      if (found.city && found.city !== options.city) {
        setNotice(`Esse CEP é de ${found.city}. Entregamos só em ${options.city}.`);
      } else if (!found.neighborhoodId) {
        setNotice(
          `Bairro "${found.neighborhood}" não está na lista de entrega. Escolha o seu abaixo; se não estiver, use a retirada.`
        );
      }
    } catch {
      setNotice('Não foi possível consultar o CEP agora: preencha a rua e o bairro.');
    }
  }

  return (
    <div className="stack gap-sm">
      <div className="form-grid">
        <PostalCodeField
          label="CEP"
          required
          value={value.postalCode}
          onValueChange={(postalCode) => {
            onChange({ ...value, postalCode });

            if (postalCode.length === 8) {
              void lookup(postalCode);
            }
          }}
          error={error('postalCode')}
        />
        <TextField
          label="Rua"
          required
          maxLength={200}
          autoComplete="address-line1"
          value={value.street}
          onChange={set('street')}
          error={error('street')}
        />
        <TextField
          label="Número"
          required
          maxLength={20}
          value={value.number}
          onChange={set('number')}
          hint='Sem número? Escreva "s/n".'
          error={error('number')}
        />
        <TextField
          label="Complemento (opcional)"
          maxLength={120}
          autoComplete="address-line2"
          value={value.complement}
          onChange={set('complement')}
        />
        <div className="field">
          <label htmlFor="bairro-entrega">
            Bairro<span aria-hidden="true"> *</span>
          </label>
          <select
            id="bairro-entrega"
            required
            value={value.neighborhoodId}
            onChange={set('neighborhoodId')}
            aria-invalid={error('neighborhoodId') ? true : undefined}
            aria-describedby="bairro-entrega-dica"
          >
            <option value="">Escolha o bairro</option>
            {options.zones.map((zone) => (
              <optgroup
                key={zone.id}
                label={`${zone.name} · ${formatMoney(zone.fee.amount)} · ${zone.leadDays} dia(s) útil(eis)`}
              >
                {zone.neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {error('neighborhoodId') ? (
            <span id="bairro-entrega-dica" className="field-error">
              {error('neighborhoodId')}
            </span>
          ) : (
            <span id="bairro-entrega-dica" className="field-hint">
              Entregamos só em {options.city}/{options.state}, nos bairros da lista.
            </span>
          )}
        </div>
        <TextField
          label="Ponto de referência (opcional)"
          maxLength={200}
          value={value.reference}
          onChange={set('reference')}
          placeholder="Portão azul, ao lado da padaria"
        />
        <PhoneField
          label="Telefone para o entregador (opcional)"
          value={value.phone}
          onValueChange={(phone) => onChange({ ...value, phone })}
          hint="Se vazio, usamos o celular do pedido."
        />
      </div>
      {notice ? <p className="muted m-0">{notice}</p> : null}
    </div>
  );
}
