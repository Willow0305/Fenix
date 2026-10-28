'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { type Courier, COURIER_KIND, type CourierKind } from '../lib/delivery-types';
import { formatPhoneDisplay } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Icon } from './icon';
import { ConfirmDialog, Empty, ErrorSummary, SelectField, TextField, useSubmit } from './ui';

interface CourierForm {
  name: string;
  kind: CourierKind;
  phone: string;
  vehicle: string;
  plate: string;
}

const EMPTY: CourierForm = { name: '', kind: 'OWN_COURIER', phone: '', vehicle: '', plate: '' };

/**
 * Entregadores para reaproveitar na saída para entrega (RN-ENT-005). Nome e telefone ficam
 * só com a diretoria; o comprador vê primeiro nome, veículo e placa.
 */
export function CouriersManager() {
  const couriers = useResource<Courier[]>('/store/couriers');
  const [editing, setEditing] = useState<Courier | 'new' | null>(null);
  const [form, setForm] = useState<CourierForm>(EMPTY);
  const [removing, setRemoving] = useState<Courier | null>(null);
  const set = (key: keyof CourierForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const save = useSubmit(async () => {
    const body = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => key === 'name' || key === 'kind' || value)
    );

    if (editing === 'new') {
      await api('/store/couriers', { method: 'POST', body });
    } else if (editing) {
      await api(`/store/couriers/${editing.id}`, { method: 'PATCH', body: form });
    }

    setEditing(null);
    await couriers.reload();
  });

  async function toggle(courier: Courier) {
    await api(`/store/couriers/${courier.id}`, {
      method: 'PATCH',
      body: { isActive: !courier.isActive }
    });
    await couriers.reload();
  }

  return (
    <section className="stack" aria-labelledby="entregadores">
      <div className="row">
        <h2 id="entregadores" className="m-0">
          Entregadores
        </h2>
        <span className="spacer" />
        {editing === null ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setForm(EMPTY);
              setEditing('new');
            }}
          >
            <Icon name="plus-lg" /> Novo entregador
          </button>
        ) : null}
      </div>
      <p className="muted m-0">
        Opcional: dá para registrar a saída sem cadastro, digitando na hora. Telefone e nome
        completo ficam só com a diretoria.
      </p>
      {editing !== null ? (
        <form className="form card" onSubmit={(event) => void save.submit(event)}>
          <ErrorSummary error={save.error} />
          <div className="form-grid">
            <TextField
              label="Nome"
              required
              maxLength={120}
              value={form.name}
              onChange={set('name')}
            />
            <SelectField
              label="Tipo"
              value={form.kind}
              onChange={set('kind')}
              options={Object.entries(COURIER_KIND).map(([value, label]) => ({ value, label }))}
            />
            <TextField label="Telefone" maxLength={30} value={form.phone} onChange={set('phone')} />
            <TextField
              label="Veículo"
              maxLength={60}
              value={form.vehicle}
              onChange={set('vehicle')}
              placeholder="Moto vermelha"
            />
            <TextField label="Placa" maxLength={10} value={form.plate} onChange={set('plate')} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              Salvar entregador
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      {couriers.data?.length === 0 ? <Empty>Nenhum entregador cadastrado.</Empty> : null}
      {couriers.data && couriers.data.length > 0 ? (
        <ul className="stack list-plain">
          {couriers.data.map((courier) => (
            <li key={courier.id} className="card row gap-sm">
              <strong>{courier.name}</strong>
              <span className="muted">
                {[
                  COURIER_KIND[courier.kind],
                  courier.vehicle,
                  courier.plate,
                  courier.phone ? formatPhoneDisplay(courier.phone) : null
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {courier.isActive ? null : <span className="badge">Desativado</span>}
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setForm({
                    name: courier.name,
                    kind: courier.kind,
                    phone: courier.phone ?? '',
                    vehicle: courier.vehicle ?? '',
                    plate: courier.plate ?? ''
                  });
                  setEditing(courier);
                }}
              >
                <Icon name="pencil" /> Editar
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void toggle(courier)}
              >
                {courier.isActive ? 'Desativar' : 'Reativar'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRemoving(courier)}
              >
                <Icon name="trash" /> Excluir
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title={`Excluir ${removing?.name ?? ''}`}
        description="Sai da lista. As entregas antigas guardam o nome, o veículo e a placa da época."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setRemoving(null)}
        onConfirm={async (reason) => {
          await api(`/store/couriers/${removing?.id ?? ''}`, {
            method: 'DELETE',
            body: { reason }
          });
          await couriers.reload();
        }}
      />
    </section>
  );
}
