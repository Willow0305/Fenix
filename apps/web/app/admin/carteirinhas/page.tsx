'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import { Icon } from '../../../components/icon';
import { MemberCardFront } from '../../../components/member-card';
import {
  Alert,
  ConfirmDialog,
  Empty,
  PageHeader,
  Pagination,
  Skeleton,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import {
  CARD_TEMPLATES,
  CARD_TYPE,
  type CardAdminDetail,
  type CardAdminRow,
  type CardDesign,
  type CardTemplate,
  type MemberCard
} from '../../../lib/card-types';
import { formatDate, formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';
import { useUrlFilters } from '../../../lib/use-url-filters';

const DEFAULTS = { busca: '', tipo: '', situacao: '' };

type Action = 'suspend' | 'reactivate' | 'cancel' | 'reissue' | 'extend' | 'rename';

const ACTION_LABEL: Record<Action, string> = {
  suspend: 'Suspender',
  reactivate: 'Reativar',
  cancel: 'Cancelar',
  reissue: 'Reemitir',
  extend: 'Estender validade',
  rename: 'Corrigir nome'
};

const ACTION_HELP: Record<Action, string> = {
  suspend: 'A carteirinha deixa de valer até ser reativada. O titular vê "fale com a diretoria".',
  reactivate: 'A carteirinha volta a valer.',
  cancel: 'Definitivo: a carteirinha deixa de existir para o titular. O histórico continua.',
  reissue:
    'Gera uma versão nova: o QR do celular e o impresso anteriores param de valer na hora (celular ou cartão perdido).',
  extend: 'Nova data final da afiliação (cortesia, compensação etc.).',
  rename: 'Só para corrigir erro de digitação: a carteirinha é pessoal e intransferível.'
};

function badgeOf(state: CardAdminRow['state']): string {
  return state === 'VALID' ? 'badge-success' : state === 'SUSPENDED' ? 'badge-warning' : '';
}

/** Detalhe com ações (sempre com motivo) e histórico de conferências. */
function CardDetail({ id, onChanged }: { readonly id: string; readonly onChanged: () => void }) {
  const { can } = useAuth();
  const detail = useResource<CardAdminDetail>(`/cards/${id}`);
  const [action, setAction] = useState<Action | null>(null);
  const [extra, setExtra] = useState({ endsOn: '', holderName: '' });

  if (!detail.data) {
    return detail.error ? <Alert kind="error">{detail.error}</Alert> : <Skeleton lines={3} />;
  }

  const c = detail.data;
  const manage = can('cards.manage');
  const available: Action[] = [];

  if (c.state !== 'CANCELLED') {
    available.push(c.state === 'SUSPENDED' ? 'reactivate' : 'suspend', 'reissue');

    if (c.type === 'AFFILIATE') {
      available.push('extend', 'rename');
    }

    available.push('cancel');
  }

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      <dl className="row" style={{ gap: '0.5rem 1.5rem', margin: 0 }}>
        <div>
          <dt className="muted">Número</dt>
          <dd>{c.code}</dd>
        </div>
        <div>
          <dt className="muted">Versão</dt>
          <dd>{c.version}</dd>
        </div>
        <div>
          <dt className="muted">Conta</dt>
          <dd>
            {c.hasAccount ? 'Vinculada' : `Sem conta${c.holderEmail ? ` (${c.holderEmail})` : ''}`}
          </dd>
        </div>
        {c.statusReason ? (
          <div>
            <dt className="muted">Motivo da situação</dt>
            <dd>{c.statusReason}</dd>
          </div>
        ) : null}
      </dl>
      {manage && available.length > 0 ? (
        <div className="row" style={{ gap: '0.5rem' }}>
          {available.map((a) => (
            <button
              key={a}
              type="button"
              className={`btn btn-sm ${a === 'cancel' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => {
                setExtra({ endsOn: c.endsOn ?? '', holderName: c.holderName });
                setAction(a);
              }}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      ) : null}
      <details className="collapsible">
        <summary>Conferências ({c.checks.length})</summary>
        {c.checks.length === 0 ? (
          <p className="muted">Ainda não foi conferida.</p>
        ) : (
          <ul style={{ paddingLeft: '1.1rem' }}>
            {c.checks.map((check) => (
              <li key={check.checkedAt}>
                {formatDateTime(check.checkedAt)} ·{' '}
                {check.valid ? 'válida' : (check.reason ?? 'inválida')}
                {check.byStaff ? ' · diretoria' : ' · parceiro/público'}
                {check.printed ? ' · impressa' : ''}
              </li>
            ))}
          </ul>
        )}
      </details>
      <ConfirmDialog
        open={action !== null}
        title={action ? `${ACTION_LABEL[action]}: ${c.holderName}` : ''}
        description={action ? ACTION_HELP[action] : undefined}
        confirmLabel={action ? ACTION_LABEL[action] : 'Confirmar'}
        danger={action === 'cancel'}
        requireReason
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          if (action === 'extend') {
            await api(`/cards/${id}/ends-on`, {
              method: 'PUT',
              body: { endsOn: extra.endsOn, reason }
            });
          } else if (action === 'rename') {
            await api(`/cards/${id}/holder-name`, {
              method: 'PUT',
              body: { holderName: extra.holderName, reason }
            });
          } else if (action) {
            await api(`/cards/${id}/${action}`, { method: 'POST', body: { reason } });
          }

          await detail.reload();
          onChanged();
        }}
      >
        {action === 'extend' ? (
          <TextField
            label="Nova data final"
            type="date"
            required
            value={extra.endsOn}
            onChange={(e) => setExtra({ ...extra, endsOn: e.target.value })}
          />
        ) : null}
        {action === 'rename' ? (
          <TextField
            label="Nome correto"
            maxLength={160}
            required
            value={extra.holderName}
            onChange={(e) => setExtra({ ...extra, holderName: e.target.value })}
          />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

const PREVIEW: MemberCard = {
  id: 'previa',
  code: 'FNX-EXEMPLO',
  type: 'AFFILIATE',
  state: 'VALID',
  stateLabel: 'Válida',
  holderName: 'Nome do Titular',
  startsOn: null,
  endsOn: '2027-12-31',
  photo: null,
  team: null,
  purchasedForOther: false,
  benefits: []
};

/** Modelo, logo e imagem de fundo, iguais para todas as carteirinhas (DT-068 F). */
function DesignSettings() {
  const { can } = useAuth();
  const design = useResource<CardDesign>('/cards/design');
  const [form, setForm] = useState<{ template: CardTemplate; useTeamLogo: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const save = useSubmit(async () => {
    if (form) {
      await api('/cards/design', { method: 'PUT', body: form });
    }

    if (file) {
      const body = new FormData();

      body.set('file', file);
      body.set('altText', 'Fundo da carteirinha');
      await api('/team-settings/brand-assets/CARD_BACKGROUND', { method: 'PUT', body });
      setFile(null);
    }

    await design.reload();
    save.setMessage('Visual salvo.');
  });

  useEffect(() => {
    if (design.data && form === null) {
      setForm({ template: design.data.template, useTeamLogo: design.data.useTeamLogo });
    }
  }, [design.data, form]);

  if (!design.data || !form) {
    return <Skeleton lines={3} />;
  }

  const manage = can('cards.manage');

  return (
    <form className="stack" onSubmit={(event) => void save.submit(event)}>
      <div className="row" style={{ alignItems: 'flex-start', gap: '1.5rem' }}>
        <MemberCardFront card={PREVIEW} design={{ ...design.data, ...form }} />
        <fieldset className="form-section" disabled={!manage}>
          <legend>Modelo</legend>
          {CARD_TEMPLATES.map((t) => (
            <label key={t.value} className="checkbox">
              <input
                type="radio"
                name="modelo"
                checked={form.template === t.value}
                onChange={() => setForm({ ...form, template: t.value })}
              />
              <span>{t.label}</span>
            </label>
          ))}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.useTeamLogo}
              onChange={(e) => setForm({ ...form, useTeamLogo: e.target.checked })}
            />
            <span>Na carteirinha de atleta, usar a logo da equipe (senão, o brasão oficial)</span>
          </label>
          {can('logos.manage') ? (
            <div className="field">
              <label htmlFor="fundo-carteirinha">Imagem de fundo (opcional, PNG/JPG/WebP)</label>
              <input
                id="fundo-carteirinha"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : null}
          {save.message ? <p className="muted">{save.message}</p> : null}
          {manage ? (
            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
                Salvar visual
              </button>
            </div>
          ) : null}
        </fieldset>
      </div>
    </form>
  );
}

function CardsList() {
  const filters = useUrlFilters(DEFAULTS);
  const { busca, tipo, situacao } = filters.values;
  const [search, setSearch] = useState(busca);
  const [open, setOpen] = useState<string | null>(null);
  const list = useResource<Page<CardAdminRow>>('/cards', {
    page: filters.page,
    pageSize: 20,
    type: tipo || undefined,
    situation: situacao || undefined,
    search: busca || undefined
  });

  useEffect(() => setSearch(busca), [busca]);

  return (
    <>
      <PageHeader
        title="Carteirinhas"
        description="Atletas ativos recebem a de atleta automaticamente; a de afiliado vem da compra na loja."
        actions={
          <Link href="/admin/carteirinhas/beneficios" className="btn btn-secondary">
            <Icon name="percent" /> Benefícios
          </Link>
        }
      />
      <form
        className="row filter-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          filters.set({ busca: search.trim() });
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou número (FNX-…)"
          />
        </label>
        <label className="field">
          <span className="label">Tipo</span>
          <select value={tipo} onChange={(e) => filters.set({ tipo: e.target.value })}>
            <option value="">Todos</option>
            <option value="ATHLETE">Atleta</option>
            <option value="AFFILIATE">Afiliado</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select value={situacao} onChange={(e) => filters.set({ situacao: e.target.value })}>
            <option value="">Todas</option>
            <option value="valid">Ativas</option>
            <option value="suspended">Suspensas</option>
            <option value="expired">Vencidas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Buscar
        </button>
      </form>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Skeleton lines={5} /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhuma carteirinha encontrada.</Empty> : null}
      {list.data && list.data.data.length > 0 ? (
        <div className="stack" style={{ gap: '0.5rem' }}>
          {list.data.data.map((c) => (
            <details
              key={c.id}
              className="card"
              open={open === c.id}
              onToggle={(e) => {
                const isOpen = (e.target as HTMLDetailsElement).open;

                setOpen(isOpen ? c.id : open === c.id ? null : open);
              }}
            >
              <summary className="row" style={{ cursor: 'pointer' }}>
                <strong>{c.holderName}</strong>
                <span className="muted">{CARD_TYPE[c.type]}</span>
                <span className="muted">{c.code}</span>
                {c.endsOn ? <span className="muted">até {formatDate(c.endsOn)}</span> : null}
                <span className="spacer" />
                <span className={`badge ${badgeOf(c.state)}`}>{c.stateLabel}</span>
              </summary>
              {open === c.id ? <CardDetail id={c.id} onChanged={() => void list.reload()} /> : null}
            </details>
          ))}
        </div>
      ) : null}
      {list.data ? <Pagination {...list.data.meta} onChange={filters.setPage} /> : null}
      <section className="card stack" aria-labelledby="visual">
        <h2 id="visual" style={{ margin: 0 }}>
          Visual da carteirinha
        </h2>
        <DesignSettings />
      </section>
    </>
  );
}

export default function CardsAdminPage() {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <CardsList />
    </Suspense>
  );
}
