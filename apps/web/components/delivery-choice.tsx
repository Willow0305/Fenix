'use client';

import { useEffect } from 'react';

import {
  type AddressForm,
  addressLine,
  type DeliveryOptions,
  type OrderFulfillment,
  previewFee,
  type SavedAddress,
  zoneOf
} from '../lib/delivery-types';
import { formatMoney } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { AddressFields } from './address-fields';
import { Icon } from './icon';

export interface DeliveryState {
  fulfillment: OrderFulfillment;
  /** Endereço salvo escolhido; vazio = digitar outro. */
  addressId: string;
  address: AddressForm;
  saveAddress: boolean;
}

/**
 * Retirar com o Fênix ou receber em casa (DT-075). Mostra a taxa da região, o prazo e quanto
 * falta para o frete grátis; a API recalcula tudo ao criar o pedido.
 */
export function DeliveryChoice({
  productsTotal,
  authenticated,
  value,
  onChange,
  onFee,
  fieldError
}: {
  /** Produtos já com desconto. */
  readonly productsTotal: string;
  readonly authenticated: boolean;
  readonly value: DeliveryState;
  readonly onChange: (next: DeliveryState) => void;
  /** Taxa prevista (nula enquanto não há bairro escolhido). */
  readonly onFee: (fee: number | null) => void;
  readonly fieldError?: (field: string) => string | undefined;
}) {
  const options = useResource<DeliveryOptions>('/public/delivery');
  const saved = useResource<SavedAddress[]>(authenticated ? '/me/addresses' : null);
  const usable = (saved.data ?? []).filter((address) => address.served);
  const data = options.data;
  const neighborhoodId =
    value.addressId !== ''
      ? (usable.find((address) => address.id === value.addressId)?.neighborhoodId ?? '')
      : value.address.neighborhoodId;
  const zone = data ? zoneOf(data, neighborhoodId) : null;
  const fee = data && value.fulfillment === 'DELIVERY' ? previewFee(data, zone, productsTotal) : 0;

  useEffect(() => onFee(fee), [fee, onFee]);

  // Primeiro uso (só ao carregar os endereços): escolhe o padrão salvo, se ainda é atendido.
  useEffect(() => {
    const preferred = usable.find((address) => address.isDefault) ?? usable[0];

    if (preferred && value.addressId === '' && value.address.street === '') {
      onChange({ ...value, addressId: preferred.id });
    }
  }, [saved.data]);

  if (!data) {
    return null;
  }

  if (!data.enabled) {
    return (
      <p className="muted m-0">
        <Icon name="shop" /> Retirada com o Fênix: avisamos quando o pedido estiver pronto.
      </p>
    );
  }

  const cheapest = Math.min(...data.zones.map((z) => Number(z.fee.amount)));
  const missing =
    data.freeMinimum && Number(productsTotal) < Number(data.freeMinimum.amount)
      ? Number(data.freeMinimum.amount) - Number(productsTotal)
      : null;

  return (
    <fieldset className="form-section stack gap-sm">
      <legend>Como receber</legend>
      <div className="choice-cards">
        <label className="choice-card">
          <input
            type="radio"
            name="recebimento"
            checked={value.fulfillment === 'PICKUP'}
            onChange={() => onChange({ ...value, fulfillment: 'PICKUP' })}
          />
          <span>
            <strong>
              <Icon name="shop" /> Retirar com o Fênix
            </strong>
            <small className="muted">Grátis. Avisamos quando estiver pronto.</small>
          </span>
        </label>
        <label className="choice-card">
          <input
            type="radio"
            name="recebimento"
            checked={value.fulfillment === 'DELIVERY'}
            onChange={() => onChange({ ...value, fulfillment: 'DELIVERY' })}
          />
          <span>
            <strong>
              <Icon name="truck" /> Receber em casa
            </strong>
            <small className="muted">
              {data.city}/{data.state}, a partir de {formatMoney(String(cheapest))}.
            </small>
          </span>
        </label>
      </div>

      {value.fulfillment === 'DELIVERY' ? (
        <>
          {data.freeMinimum ? (
            <p className="m-0">
              {missing === null ? (
                <strong>Entrega grátis neste pedido!</strong>
              ) : (
                <>
                  Faltam <strong>{formatMoney(missing.toFixed(2))}</strong> em produtos para a
                  entrega grátis (a partir de {formatMoney(data.freeMinimum.amount)}).
                </>
              )}
            </p>
          ) : null}
          {usable.length > 0 ? (
            <div className="stack gap-sm" role="radiogroup" aria-label="Endereço de entrega">
              {usable.map((address) => (
                <label key={address.id} className="checkbox">
                  <input
                    type="radio"
                    name="endereco"
                    checked={value.addressId === address.id}
                    onChange={() => onChange({ ...value, addressId: address.id })}
                  />
                  <span>
                    {address.label ? <strong>{address.label}: </strong> : null}
                    {addressLine(address)}
                  </span>
                </label>
              ))}
              <label className="checkbox">
                <input
                  type="radio"
                  name="endereco"
                  checked={value.addressId === ''}
                  onChange={() => onChange({ ...value, addressId: '' })}
                />
                <span>Outro endereço</span>
              </label>
            </div>
          ) : null}
          {value.addressId === '' ? (
            <>
              <AddressFields
                options={data}
                value={value.address}
                onChange={(address) => onChange({ ...value, address })}
                {...(fieldError ? { fieldError } : {})}
              />
              {authenticated ? (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={value.saveAddress}
                    onChange={(e) => onChange({ ...value, saveAddress: e.target.checked })}
                  />
                  <span>Guardar este endereço na minha conta</span>
                </label>
              ) : null}
            </>
          ) : null}
          {zone ? (
            <p className="m-0">
              <Icon name="clock" /> Entrega em cerca de {zone.leadDays} dia(s) útil(eis) depois do
              pagamento · taxa {fee === 0 ? 'grátis' : formatMoney((fee ?? 0).toFixed(2))}.
            </p>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}
