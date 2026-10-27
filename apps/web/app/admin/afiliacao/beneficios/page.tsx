'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AffiliationNav } from '../../../../components/affiliation-nav';
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
  /** Parceiro cadastrado no site ou só de boca a boca (DT-074). */
  kind: 'registered' | 'informal';
  partnerId: string;
  partnerName: string;
  partnerDetails: string;
  title: string;
  discountPercent: string;
  conditions: string;
  audience: BenefitAudience;
  startsOn: string;
  endsOn: string;
}

const EMPTY: FormState = {
  kind: 'informal',
  partnerId: '',
  partnerName: '',
  partnerDetails: '',
  title: '',
  discountPercent: '',
  conditions: '',
  audience: 'BOTH',
  startsOn: '',
  endsOn: ''
};

function formOf(b: BenefitAdmin): FormState {
  return {
    kind: b.partner.id ? 'registered' : 'informal',
    partnerId: b.partner.id ?? '',
    partnerName: b.partner.id ? '' : b.partner.name,
    partnerDetails: b.partner.details ?? '',
    title: b.title,
    discountPercent: b.discountPercent,
    conditions: b.conditions ?? '',
    audience: b.audience,
    startsOn: b.startsOn ?? '',
    endsOn: b.endsOn ?? ''
  };
}

function BenefitsAdmin() {
  const params = useSearchParams();
  const router = useRouter();
  // Filtro por tipo de carteirinha: "ATHLETES" mostra os de atleta e os de ambos.
  const publico = params.get('publico');
  const audience = publico === 'ATHLETES' || publico === 'AFFILIATES' ? publico : null;
  const benefits = useResource<BenefitAdmin[]>('/partner-benefits');
  const shown = (benefits.data ?? []).filter(
    (b) => audience === null || b.audience === 'BOTH' || b.audience === audience
  );
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

    const informal = form.kind === 'informal';

    if (editing === 'new') {
      await api('/partner-benefits', {
        method: 'POST',
        body: {
          ...body,
          ...(informal
            ? {
                partnerName: form.partnerName,
                ...(form.partnerDetails ? { partnerDetails: form.partnerDetails } : {})
              }
            : { partnerId: form.partnerId }),
          ...(form.startsOn ? {} : { startsOn: undefined }),
          ...(form.endsOn ? {} : { endsOn: undefined })
        }
      });
    } else if (editing) {
      await api(`/partner-benefits/${editing.id}`, {
        method: 'PATCH',
        body: informal
          ? { ...body, partnerName: form.partnerName, partnerDetails: form.partnerDetails }
          : body
      });
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
        description="Descontos dos parceiros para quem tem carteirinha. Desative para pausar sem perder o cadastro; aparecem na carteirinha, na conferência e no site."
        actions={
          <div className="row">
            {editing === null ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setForm({ ...EMPTY, audience: audience ?? 'BOTH' });
                  setEditing('new');
                }}
              >
                <Icon name="plus-lg" /> Novo benefício
              </button>
            ) : null}
          </div>
        }
      />
      <AffiliationNav />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {editing !== null ? (
        <form className="form card" onSubmit={(event) => void save.submit(event)}>
          <h2 style={{ margin: 0 }}>
            {editing === 'new' ? 'Novo benefício' : `Editar: ${editing.title}`}
          </h2>
          <ErrorSummary error={save.error} />
          {editing === 'new' ? (
            <fieldset className="form-section">
              <legend>Parceiro</legend>
              <label className="checkbox">
                <input
                  type="radio"
                  name="tipo-parceiro"
                  checked={form.kind === 'informal'}
                  onChange={() => setForm({ ...form, kind: 'informal' })}
                />
                <span>Parceiro sem cadastro no site (combinado direto com a loja)</span>
              </label>
              <label className="checkbox">
                <input
                  type="radio"
                  name="tipo-parceiro"
                  checked={form.kind === 'registered'}
                  onChange={() => setForm({ ...form, kind: 'registered' })}
                />
                <span>Parceiro cadastrado em Parceiros</span>
              </label>
            </fieldset>
          ) : null}
          <div className="form-grid">
            {form.kind === 'informal' ? (
              <>
                <TextField
                  label="Nome do parceiro"
                  maxLength={120}
                  required
                  value={form.partnerName}
                  onChange={set('partnerName')}
                  placeholder="Ótica Central"
                />
                <TextField
                  label="Onde fica / contato (opcional)"
                  maxLength={500}
                  value={form.partnerDetails}
                  onChange={set('partnerDetails')}
                  placeholder="Rua Exemplo, 123 — Centro"
                  hint="Aparece para quem tem carteirinha."
                />
              </>
            ) : (
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
            )}
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
      <div className="row" role="group" aria-label="Tipo de carteirinha">
        {(
          [
            [null, 'Todos'],
            ['ATHLETES', 'Carteirinha de atleta'],
            ['AFFILIATES', 'Carteirinha de afiliado']
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={`btn btn-sm ${audience === value ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={audience === value}
            onClick={() =>
              router.replace(
                value
                  ? `/admin/afiliacao/beneficios?publico=${value}`
                  : '/admin/afiliacao/beneficios'
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      {benefits.data && shown.length === 0 ? <Empty>Nenhum benefício cadastrado.</Empty> : null}
      {shown.length > 0 ? (
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
              {shown.map((b) => (
                <tr key={b.id}>
                  <td data-label="Parceiro">
                    {b.partner.name}
                    {b.partner.id ? null : (
                      <div className="muted">
                        Sem cadastro{b.partner.details ? ` · ${b.partner.details}` : ''}
                      </div>
                    )}
                  </td>
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

/** Benefícios de parceiros para quem tem carteirinha (DT-068 D). */
export default function BenefitsAdminPage() {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <BenefitsAdmin />
    </Suspense>
  );
}
