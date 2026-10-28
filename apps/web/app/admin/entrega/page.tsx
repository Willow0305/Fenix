'use client';

import { useEffect, useState } from 'react';

import { Icon } from '../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  Skeleton,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { DeliveryAdmin, DeliveryZone } from '../../../lib/delivery-types';
import { formatMoney } from '../../../lib/format';
import { normalizeAmount } from '../../../lib/idempotency';
import { useResource } from '../../../lib/use-resource';

interface ZoneForm {
  name: string;
  fee: string;
  leadDays: string;
  neighborhoods: string;
}

const EMPTY_ZONE: ZoneForm = { name: '', fee: '', leadDays: '1', neighborhoods: '' };

function zoneForm(zone: DeliveryZone): ZoneForm {
  return {
    name: zone.name,
    fee: zone.fee.amount,
    leadDays: String(zone.leadDays),
    neighborhoods: zone.neighborhoods.map((n) => n.name).join('\n')
  };
}

/** Região nova ou em edição: nome, taxa, prazo e bairros (um por linha). */
function ZoneEditor({
  initial,
  title,
  onSave,
  onCancel
}: {
  readonly initial: ZoneForm;
  readonly title: string;
  readonly onSave: (form: ZoneForm) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const save = useSubmit(() => onSave(form));
  const set = (key: keyof ZoneForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <form className="form card" onSubmit={(event) => void save.submit(event)}>
      <h2 className="m-0">{title}</h2>
      <ErrorSummary error={save.error} />
      <div className="form-grid">
        <TextField
          label="Nome da região"
          required
          maxLength={80}
          value={form.name}
          onChange={set('name')}
          placeholder="Centro"
        />
        <TextField
          label="Taxa de entrega (R$)"
          required
          numeric="decimal"
          maxLength={10}
          value={form.fee}
          onChange={set('fee')}
          hint="0 = entrega grátis nessa região."
        />
        <TextField
          label="Prazo (dias úteis)"
          required
          numeric="integer"
          maxLength={2}
          value={form.leadDays}
          onChange={set('leadDays')}
          hint="Depois do pagamento (ou da chegada da remessa)."
        />
      </div>
      <TextArea
        label="Bairros atendidos"
        required
        maxLength={4000}
        rows={6}
        value={form.neighborhoods}
        onChange={set('neighborhoods')}
        hint="Um por linha. Cada bairro pode estar em uma só região."
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          Salvar região
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Painel → Loja → Entrega (DT-075): entrega em casa em Rio Branco por região. */
export default function DeliveryAdminPage() {
  const data = useResource<DeliveryAdmin>('/store/delivery');
  const [settings, setSettings] = useState<{
    enabled: boolean;
    city: string;
    state: string;
    freeMinimum: string;
  } | null>(null);
  const [editing, setEditing] = useState<DeliveryZone | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DeliveryZone | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (data.data && settings === null) {
      setSettings({
        enabled: data.data.configuredEnabled,
        city: data.data.city,
        state: data.data.state,
        freeMinimum: data.data.freeMinimum?.amount ?? ''
      });
    }
  }, [data.data, settings]);

  const saveSettings = useSubmit(async () => {
    if (!settings) {
      return;
    }

    data.setData(
      await api<DeliveryAdmin>('/store/delivery/settings', {
        method: 'PUT',
        body: {
          enabled: settings.enabled,
          city: settings.city,
          state: settings.state,
          freeMinimum: settings.freeMinimum ? normalizeAmount(settings.freeMinimum) : ''
        }
      })
    );
    setNotice('Configuração da entrega salva.');
  });

  async function saveZone(form: ZoneForm) {
    const body = {
      name: form.name,
      fee: normalizeAmount(form.fee),
      leadDays: Number(form.leadDays),
      neighborhoods: [form.neighborhoods]
    };

    if (editing === 'new') {
      await api('/store/delivery/zones', { method: 'POST', body });
    } else if (editing) {
      await api(`/store/delivery/zones/${editing.id}`, { method: 'PATCH', body });
    }

    setNotice(editing === 'new' ? 'Região criada.' : 'Região atualizada.');
    setEditing(null);
    await data.reload();
  }

  async function toggle(zone: DeliveryZone) {
    await api(`/store/delivery/zones/${zone.id}`, {
      method: 'PATCH',
      body: { isActive: !zone.isActive }
    });
    setNotice(zone.isActive ? 'Região desativada.' : 'Região reativada.');
    await data.reload();
  }

  if (!data.data || !settings) {
    return data.error ? <Alert kind="error">{data.error}</Alert> : <Skeleton lines={5} />;
  }

  const d = data.data;

  return (
    <>
      <PageHeader
        title="Entrega em casa"
        description="Regiões e bairros atendidos, taxa, prazo e frete grátis. Fora da lista, o comprador só retira."
        actions={
          editing === null ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="plus-lg" /> Nova região
            </button>
          ) : null
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <form className="form card" onSubmit={(event) => void saveSettings.submit(event)}>
        <div className="row">
          <h2 className="m-0">Configuração</h2>
          <span className="spacer" />
          <span className={`badge ${d.enabled ? 'badge-success' : ''}`}>
            {d.enabled ? 'Entrega disponível no site' : 'Só retirada no site'}
          </span>
        </div>
        <ErrorSummary error={saveSettings.error} />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          <span>Oferecer entrega em casa no checkout</span>
        </label>
        <div className="form-grid">
          <TextField
            label="Cidade atendida"
            required
            maxLength={120}
            value={settings.city}
            onChange={(e) => setSettings({ ...settings, city: e.target.value })}
          />
          <TextField
            label="UF"
            required
            maxLength={2}
            value={settings.state}
            onChange={(e) => setSettings({ ...settings, state: e.target.value.toUpperCase() })}
          />
          <TextField
            label="Frete grátis a partir de (R$)"
            numeric="decimal"
            maxLength={12}
            value={settings.freeMinimum}
            onChange={(e) => setSettings({ ...settings, freeMinimum: e.target.value })}
            hint="Vale para os produtos já com desconto. Vazio = sem frete grátis."
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saveSettings.pending}>
            Salvar configuração
          </button>
        </div>
      </form>

      {editing !== null ? (
        <ZoneEditor
          key={editing === 'new' ? 'nova' : editing.id}
          title={editing === 'new' ? 'Nova região' : `Editar: ${editing.name}`}
          initial={editing === 'new' ? EMPTY_ZONE : zoneForm(editing)}
          onSave={saveZone}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <section className="stack" aria-labelledby="regioes">
        <h2 id="regioes" className="m-0">
          Regiões ({d.zones.length})
        </h2>
        {d.zones.length === 0 ? (
          <Empty>Nenhuma região. Crie a primeira com os bairros e a taxa.</Empty>
        ) : (
          <div className="card-grid">
            {d.zones.map((zone) => (
              <article key={zone.id} className="card stack gap-sm">
                <div className="row">
                  <strong>{zone.name}</strong>
                  <span className={`badge ${zone.isActive ? 'badge-success' : ''}`}>
                    {zone.isActive ? 'Ativa' : 'Desativada'}
                  </span>
                </div>
                <p className="m-0">
                  {zone.fee.amount === '0.00' ? 'Grátis' : formatMoney(zone.fee.amount)} ·{' '}
                  {zone.leadDays} dia(s) útil(eis)
                </p>
                <p className="muted m-0 text-break">
                  {zone.neighborhoods.map((n) => n.name).join(', ')}
                </p>
                <div className="row gap-sm">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditing(zone)}
                  >
                    <Icon name="pencil" /> Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void toggle(zone)}
                  >
                    {zone.isActive ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDeleting(zone)}
                  >
                    <Icon name="trash" /> Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir ${deleting?.name ?? ''}`}
        description="Os bairros dela deixam de ser atendidos. Pedidos já feitos guardam o endereço e a taxa da compra. Para pausar, prefira desativar."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          await api(`/store/delivery/zones/${deleting?.id ?? ''}`, {
            method: 'DELETE',
            body: { reason }
          });
          setNotice('Região excluída.');
          await data.reload();
        }}
      />
    </>
  );
}
