'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '../../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  SelectField,
  Skeleton,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import {
  BENEFIT_AUDIENCE,
  type BenefitAdmin,
  type BenefitAudience
} from '../../../../lib/card-types';
import { formatDate } from '../../../../lib/format';
import { useResource } from '../../../../lib/use-resource';

interface PartnerOption {
  id: string;
  displayName: string;
  status: string;
}

interface FormState {
  partnerId: string;
  title: string;
  discountPercent: string;
  conditions: string;
  audience: BenefitAudience;
  startsOn: string;
  endsOn: string;
}

const EMPTY: FormState = {
  partnerId: '',
  title: '',
  discountPercent: '',
  conditions: '',
  audience: 'BOTH',
  startsOn: '',
  endsOn: ''
};

function formOf(b: BenefitAdmin): FormState {
  return {
    partnerId: b.partner.id,
    title: b.title,
    discountPercent: b.discountPercent,
    conditions: b.conditions ?? '',
    audience: b.audience,
    startsOn: b.startsOn ?? '',
    endsOn: b.endsOn ?? ''
  };
}

/** Benefícios de parceiros para quem tem carteirinha (DT-068 D). */
export default function BenefitsAdminPage() {
  const benefits = useResource<BenefitAdmin[]>('/partner-benefits');
  const partners = useResource<Page<PartnerOption>>('/partners', { pageSize: 100 });
  const [editing, setEditing] = useState<BenefitAdmin | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleting, setDeleting] = useState<BenefitAdmin | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const set = (key: keyof FormState) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const save = useSubmit(async () => {
    const body = {
      title: form.title,
      discountPercent: form.discountPercent,
      conditions: form.conditions,
      audience: form.audience,
      startsOn: form.startsOn,
      endsOn: form.endsOn
    };

    if (editing === 'new') {
      await api('/partner-benefits', {
        method: 'POST',
        body: {
          ...body,
          partnerId: form.partnerId,
          ...(form.startsOn ? {} : { startsOn: undefined }),
          ...(form.endsOn ? {} : { endsOn: undefined })
        }
      });
    } else if (editing) {
      await api(`/partner-benefits/${editing.id}`, { method: 'PATCH', body });
    }

    setNotice(editing === 'new' ? 'Benefício criado.' : 'Benefício atualizado.');
    setEditing(null);
    await benefits.reload();
  });

  async function toggle(b: BenefitAdmin) {
    await api(`/partner-benefits/${b.id}`, { method: 'PATCH', body: { isActive: !b.isActive } });
    setNotice(b.isActive ? 'Benefício desativado.' : 'Benefício reativado.');
    await benefits.reload();
  }

  return (
    <>
      <PageHeader
        title="Benefícios de parceiros"
        description="Descontos para quem tem carteirinha. Aparecem na carteirinha, na conferência e no site."
        actions={
          <div className="row">
            <Link href="/admin/carteirinhas" className="btn btn-secondary">
              <Icon name="arrow-left" /> Carteirinhas
            </Link>
            {editing === null ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setForm(EMPTY);
                  setEditing('new');
                }}
              >
                <Icon name="plus-lg" /> Novo benefício
              </button>
            ) : null}
          </div>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {editing !== null ? (
        <form className="form card" onSubmit={(event) => void save.submit(event)}>
          <h2 style={{ margin: 0 }}>
            {editing === 'new' ? 'Novo benefício' : `Editar: ${editing.title}`}
          </h2>
          <ErrorSummary error={save.error} />
          <div className="form-grid">
            <SelectField
              label="Parceiro"
              required
              disabled={editing !== 'new'}
              value={form.partnerId}
              onChange={set('partnerId')}
              options={[
                { value: '', label: 'Selecione' },
                ...(partners.data?.data ?? []).map((p) => ({
                  value: p.id,
                  label: p.status === 'ACTIVE' ? p.displayName : `${p.displayName} (inativo)`
                }))
              ]}
            />
            <TextField
              label="Título"
              maxLength={120}
              required
              value={form.title}
              onChange={set('title')}
              placeholder="Desconto em toda a loja"
            />
            <TextField
              label="Desconto (%)"
              numeric="decimal"
              maxLength={6}
              required
              value={form.discountPercent}
              onChange={set('discountPercent')}
              hint="De 1 a 100."
            />
            <SelectField
              label="Vale para"
              value={form.audience}
              onChange={set('audience')}
              options={Object.entries(BENEFIT_AUDIENCE).map(([value, label]) => ({ value, label }))}
            />
            <TextField
              label="Início (opcional)"
              type="date"
              value={form.startsOn}
              onChange={set('startsOn')}
            />
            <TextField
              label="Fim (opcional)"
              type="date"
              value={form.endsOn}
              onChange={set('endsOn')}
            />
          </div>
          <TextArea
            label="Condições (opcional)"
            maxLength={1000}
            value={form.conditions}
            onChange={set('conditions')}
            hint='Ex.: "Não cumulativo com outras promoções".'
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              Salvar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {benefits.error ? <Alert kind="error">{benefits.error}</Alert> : null}
      {benefits.loading && !benefits.data ? <Skeleton lines={4} /> : null}
      {benefits.data?.length === 0 ? <Empty>Nenhum benefício cadastrado.</Empty> : null}
      {benefits.data && benefits.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Parceiro</th>
                <th scope="col">Benefício</th>
                <th scope="col" className="num">
                  Desconto
                </th>
                <th scope="col">Vale para</th>
                <th scope="col">Período</th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {benefits.data.map((b) => (
                <tr key={b.id}>
                  <td data-label="Parceiro">{b.partner.name}</td>
                  <td data-label="Benefício">
                    {b.title}
                    {b.conditions ? <div className="muted line-clamp-2">{b.conditions}</div> : null}
                  </td>
                  <td data-label="Desconto" className="num">
                    {b.discountPercent}%
                  </td>
                  <td data-label="Vale para">{BENEFIT_AUDIENCE[b.audience]}</td>
                  <td data-label="Período">
                    {b.startsOn || b.endsOn
                      ? `${b.startsOn ? formatDate(b.startsOn) : '…'} a ${b.endsOn ? formatDate(b.endsOn) : '…'}`
                      : 'Sem prazo'}
                  </td>
                  <td data-label="Situação">
                    <span className={`badge ${b.inEffect ? 'badge-success' : ''}`}>
                      {b.inEffect
                        ? 'Valendo'
                        : b.isActive
                          ? 'Fora do período ou parceiro inativo'
                          : 'Desativado'}
                    </span>
                  </td>
                  <td data-label="Ações">
                    <div className="row" style={{ gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setForm(formOf(b));
                          setEditing(b);
                        }}
                      >
                        <Icon name="pencil" /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void toggle(b)}
                      >
                        {b.isActive ? 'Desativar' : 'Reativar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDeleting(b)}
                      >
                        <Icon name="trash" /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir ${deleting?.title ?? ''}`}
        description="O benefício sai da carteirinha e do site. Para pausar, prefira desativar."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          await api(`/partner-benefits/${deleting?.id ?? ''}`, {
            method: 'DELETE',
            body: { reason }
          });
          setNotice('Benefício excluído.');
          await benefits.reload();
        }}
      />
    </>
  );
}
