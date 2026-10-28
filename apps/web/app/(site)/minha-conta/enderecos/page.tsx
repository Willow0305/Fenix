'use client';

import { useState } from 'react';

import { AddressFields } from '../../../../components/address-fields';
import { Icon } from '../../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  Skeleton,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import {
  addressBody,
  addressLine,
  type DeliveryOptions,
  EMPTY_ADDRESS,
  type SavedAddress
} from '../../../../lib/delivery-types';
import { useResource } from '../../../../lib/use-resource';

/** Meus endereços de entrega (DT-075): até 10; apagar remove de vez (LGPD). */
export default function AddressesPage() {
  const options = useResource<DeliveryOptions>('/public/delivery');
  const addresses = useResource<SavedAddress[]>('/me/addresses');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [label, setLabel] = useState('');
  const [removing, setRemoving] = useState<SavedAddress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const add = useSubmit(async () => {
    await api('/me/addresses', {
      method: 'POST',
      body: { ...addressBody(form), ...(label.trim() ? { label } : {}) }
    });
    setAdding(false);
    setForm(EMPTY_ADDRESS);
    setLabel('');
    setNotice('Endereço guardado.');
    await addresses.reload();
  });

  async function makeDefault(address: SavedAddress) {
    addresses.setData(
      await api<SavedAddress[]>(`/me/addresses/${address.id}/default`, { method: 'PUT' })
    );
    setNotice('Endereço padrão atualizado.');
  }

  const enabled = options.data?.enabled ?? false;

  return (
    <>
      <PageHeader
        title="Endereços"
        description="Endereços para receber pedidos da loja em casa. Só a diretoria, ao cuidar do seu pedido, vê o endereço."
        actions={
          enabled && !adding ? (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus-lg" /> Novo endereço
            </button>
          ) : null
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {options.data && !enabled ? (
        <Alert kind="info">
          A entrega em casa não está disponível no momento; os pedidos são retirados com o Fênix.
        </Alert>
      ) : null}
      {adding && options.data ? (
        <form className="form card" onSubmit={(event) => void add.submit(event)}>
          <h2 className="m-0">Novo endereço</h2>
          <ErrorSummary error={add.error} />
          <TextField
            label="Nome do endereço (opcional)"
            maxLength={60}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Casa, Trabalho…"
          />
          <AddressFields
            options={options.data}
            value={form}
            onChange={setForm}
            fieldError={add.fieldError}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={add.pending}>
              Guardar endereço
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      {addresses.error ? <Alert kind="error">{addresses.error}</Alert> : null}
      {!addresses.data && !addresses.error ? <Skeleton lines={3} /> : null}
      {addresses.data?.length === 0 ? (
        <Empty>Nenhum endereço guardado. Você também pode guardar no checkout.</Empty>
      ) : null}
      {addresses.data && addresses.data.length > 0 ? (
        <ul className="stack list-plain">
          {addresses.data.map((address) => (
            <li key={address.id} className="card stack gap-sm">
              <div className="row">
                <strong>{address.label ?? 'Endereço'}</strong>
                {address.isDefault ? <span className="badge badge-success">Padrão</span> : null}
                {!address.served ? (
                  <span className="badge badge-warning">Bairro fora da entrega</span>
                ) : null}
              </div>
              <span className="text-break">{addressLine(address)}</span>
              {address.reference ? <span className="muted">{address.reference}</span> : null}
              <div className="row gap-sm">
                {!address.isDefault ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void makeDefault(address)}
                  >
                    Usar como padrão
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRemoving(address)}
                >
                  <Icon name="trash" /> Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title="Apagar endereço"
        description="O endereço sai da sua conta. Pedidos já feitos continuam com o endereço da compra."
        confirmLabel="Apagar"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await api(`/me/addresses/${removing?.id ?? ''}`, { method: 'DELETE' });
          setNotice('Endereço apagado.');
          await addresses.reload();
        }}
      />
    </>
  );
}
