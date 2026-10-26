'use client';

import { useState } from 'react';

import { Icon } from '../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page, Role } from '../../../lib/api-types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { normalizeAmount } from '../../../lib/idempotency';
import {
  type Coupon,
  COUPON_AUDIENCE,
  COUPON_SCOPE,
  type CouponAudience,
  type CouponDiscountType,
  type CouponRedemption,
  type CouponScope,
  type ProductDetail,
  type StoreCategory
} from '../../../lib/store-types';
import { useResource } from '../../../lib/use-resource';

interface FormState {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  value: string;
  scope: CouponScope;
  audience: CouponAudience;
  minimumOrderAmount: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  maxPerCustomer: string;
  productIds: Set<string>;
  categoryIds: Set<string>;
  roleIds: Set<string>;
}

/** `datetime-local` usa hora local sem fuso; a API recebe ISO em UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromCoupon(coupon?: Coupon): FormState {
  return {
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    discountType: coupon?.discountType ?? 'PERCENTAGE',
    value:
      coupon?.discountType === 'FIXED'
        ? (coupon.amount?.amount.replace('.', ',') ?? '')
        : (coupon?.percentage?.replace('.', ',') ?? ''),
    scope: coupon?.scope ?? 'ALL',
    audience: coupon?.audience ?? 'EVERYONE',
    minimumOrderAmount: coupon?.minimumOrderAmount?.amount.replace('.', ',') ?? '',
    startsAt: toLocalInput(coupon?.startsAt ?? null),
    endsAt: toLocalInput(coupon?.endsAt ?? null),
    maxRedemptions: coupon?.maxRedemptions ? String(coupon.maxRedemptions) : '',
    maxPerCustomer: coupon?.maxPerCustomer ? String(coupon.maxPerCustomer) : '',
    productIds: new Set(coupon?.products.map((p) => p.id)),
    categoryIds: new Set(coupon?.categories.map((c) => c.id)),
    roleIds: new Set(coupon?.roles.map((r) => r.id))
  };
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return next;
}

/** Lista com caixas para escolher produtos, categorias ou públicos. */
function PickList({
  label,
  items,
  selected,
  onToggle,
  hint
}: {
  readonly label: string;
  readonly items: readonly { id: string; name: string; note?: string }[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly hint?: string;
}) {
  return (
    <fieldset className="form-section">
      <legend>
        {label} ({selected.size} escolhido(s))
      </legend>
      {hint ? <span className="field-hint">{hint}</span> : null}
      {items.length === 0 ? (
        <p className="muted">Nada para escolher.</p>
      ) : (
        <ul className="pick-list">
          {items.map((item) => (
            <li key={item.id}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span>
                  {item.name}
                  {item.note ? <small className="muted"> · {item.note}</small> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function CouponForm({
  source,
  onSaved,
  onCancel
}: {
  readonly source?: Coupon;
  readonly onSaved: (coupon: Coupon) => void;
  readonly onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => fromCoupon(source));
  const [productSearch, setProductSearch] = useState('');
  const products = useResource<Page<ProductDetail>>(
    form.scope === 'PRODUCTS' ? '/store/products' : null,
    { pageSize: 100, search: productSearch }
  );
  const categories = useResource<StoreCategory[]>(
    form.scope === 'CATEGORIES' ? '/store/categories' : null
  );
  const roles = useResource<Role[]>(form.audience === 'ROLES' ? '/roles' : null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = useSubmit(async () => {
    const body = {
      code: form.code.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      discountType: form.discountType,
      ...(form.discountType === 'PERCENTAGE'
        ? { percentage: normalizeAmount(form.value) }
        : { amount: normalizeAmount(form.value) }),
      scope: form.scope,
      audience: form.audience,
      ...(form.minimumOrderAmount
        ? { minimumOrderAmount: normalizeAmount(form.minimumOrderAmount) }
        : {}),
      ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
      ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
      ...(form.maxRedemptions ? { maxRedemptions: Number(form.maxRedemptions) } : {}),
      ...(form.maxPerCustomer ? { maxPerCustomer: Number(form.maxPerCustomer) } : {}),
      isActive: source?.isActive ?? true,
      productIds: [...form.productIds],
      categoryIds: [...form.categoryIds],
      roleIds: [...form.roleIds]
    };

    onSaved(
      await api<Coupon>(source ? `/store/coupons/${source.id}` : '/store/coupons', {
        method: source ? 'PUT' : 'POST',
        body
      })
    );
  });
  // Produtos já escolhidos continuam visíveis mesmo fora da busca atual.
  const productItems = [
    ...(source?.products ?? []).filter(
      (p) => !(products.data?.data ?? []).some((loaded) => loaded.id === p.id)
    ),
    ...(products.data?.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      ...(p.partner ? { note: `parceiro ${p.partner.name}: cupom não se aplica` } : {})
    }))
  ];

  return (
    <form className="form" onSubmit={(event) => void save.submit(event)}>
      <ErrorSummary error={save.error} />
      <div className="form-grid">
        <TextField
          label="Código"
          required
          maxLength={40}
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
          hint="Letras, números, - ou _. Ex.: ATLETA10"
          error={save.fieldError('code')}
        />
        <SelectField
          label="Tipo de desconto"
          value={form.discountType}
          onChange={(e) => set('discountType', e.target.value as CouponDiscountType)}
          options={[
            { value: 'PERCENTAGE', label: 'Percentual (%)' },
            { value: 'FIXED', label: 'Valor fixo (R$)' }
          ]}
        />
        <TextField
          label={form.discountType === 'PERCENTAGE' ? 'Percentual (%)' : 'Valor (R$)'}
          required
          numeric="decimal"
          maxLength={16}
          value={form.value}
          onChange={(e) => set('value', e.target.value)}
          hint={
            form.discountType === 'FIXED'
              ? 'Nunca passa do valor dos produtos que participam.'
              : 'De 0,01 a 100.'
          }
          error={save.fieldError(form.discountType === 'PERCENTAGE' ? 'percentage' : 'amount')}
        />
        <TextField
          label="Pedido mínimo (R$, opcional)"
          numeric="decimal"
          maxLength={16}
          value={form.minimumOrderAmount}
          onChange={(e) => set('minimumOrderAmount', e.target.value)}
        />
        <TextField
          label="Começa em (opcional)"
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => set('startsAt', e.target.value)}
        />
        <TextField
          label="Termina em (opcional)"
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => set('endsAt', e.target.value)}
          error={save.fieldError('endsAt')}
        />
        <TextField
          label="Usos no total (opcional)"
          type="number"
          min={1}
          value={form.maxRedemptions}
          onChange={(e) => set('maxRedemptions', e.target.value)}
        />
        <TextField
          label="Usos por pessoa (opcional)"
          type="number"
          min={1}
          value={form.maxPerCustomer}
          onChange={(e) => set('maxPerCustomer', e.target.value)}
          hint="Conta por conta ou, sem login, por e-mail."
        />
      </div>
      <TextField
        label="Descrição interna (opcional)"
        maxLength={500}
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        hint="Ex.: campanha de volta às aulas; não aparece para o cliente."
      />

      <div className="form-grid">
        <SelectField
          label="Vale para"
          value={form.scope}
          onChange={(e) => set('scope', e.target.value as CouponScope)}
          options={Object.entries(COUPON_SCOPE).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Quem pode usar"
          value={form.audience}
          onChange={(e) => set('audience', e.target.value as CouponAudience)}
          options={Object.entries(COUPON_AUDIENCE).map(([value, label]) => ({ value, label }))}
        />
      </div>

      {form.scope === 'PRODUCTS' ? (
        <div className="stack" style={{ gap: '0.5rem' }}>
          <label className="field">
            <span className="label">Buscar produto</span>
            <input
              maxLength={120}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Nome ou SKU"
            />
          </label>
          <PickList
            label="Produtos"
            items={productItems}
            selected={form.productIds}
            onToggle={(id) => set('productIds', toggle(form.productIds, id))}
          />
        </div>
      ) : null}
      {form.scope === 'CATEGORIES' ? (
        <PickList
          label="Categorias da loja"
          items={categories.data ?? []}
          selected={form.categoryIds}
          onToggle={(id) => set('categoryIds', toggle(form.categoryIds, id))}
        />
      ) : null}
      {form.audience === 'ROLES' ? (
        roles.error ? (
          <Alert kind="warning">Sua conta não pode listar os públicos: {roles.error}</Alert>
        ) : (
          <PickList
            label="Públicos"
            items={(roles.data ?? []).map((role) => ({
              id: role.id,
              name: role.name,
              note: `${role.userCount} pessoa(s)`
            }))}
            selected={form.roleIds}
            onToggle={(id) => set('roleIds', toggle(form.roleIds, id))}
            hint="Ex.: Diretoria, Atleta. Quem tiver qualquer um dos papéis pode usar."
          />
        )
      ) : null}
      <p className="muted" style={{ margin: 0 }}>
        <Icon name="info-circle" /> Um cupom por pedido. Produtos de parceiros nunca recebem
        desconto, para não alterar comissão e repasse.
      </p>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          <Icon name="check-lg" />{' '}
          {save.pending ? 'Salvando…' : source ? 'Salvar cupom' : 'Criar cupom'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function describe(coupon: Coupon): string {
  const value =
    coupon.discountType === 'PERCENTAGE'
      ? `${coupon.percentage?.replace('.', ',')}%`
      : formatMoney(coupon.amount?.amount);
  const target =
    coupon.scope === 'ALL'
      ? 'em toda a loja'
      : coupon.scope === 'PRODUCTS'
        ? `em ${coupon.products.map((p) => p.name).join(', ')}`
        : `em ${coupon.categories.map((c) => c.name).join(', ')}`;
  const who =
    coupon.audience === 'ROLES'
      ? ` · para ${coupon.roles.map((r) => r.name).join(', ')}`
      : coupon.audience === 'LOGGED_IN'
        ? ' · só com conta'
        : '';

  return `${value} ${target}${who}`;
}

/** Cupons de desconto da loja (DT-045). */
export default function CouponsPage() {
  const coupons = useResource<Coupon[]>('/store/coupons');
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [viewing, setViewing] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const redemptions = useResource<CouponRedemption[]>(
    viewing ? `/store/coupons/${viewing.id}/redemptions` : null
  );

  async function setActive(coupon: Coupon) {
    await api(`/store/coupons/${coupon.id}/active`, {
      method: 'PUT',
      body: { isActive: !coupon.isActive }
    });
    await coupons.reload();
  }

  return (
    <>
      <PageHeader
        title="Cupons de desconto"
        description="Desconto por produto, categoria ou público (diretoria, atletas…). Um cupom por pedido."
        actions={
          editing === null ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="plus-lg" /> Novo cupom
            </button>
          ) : null
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {editing !== null ? (
        <section className="card stack" aria-labelledby="cupom-form">
          <h2 id="cupom-form">{editing === 'new' ? 'Novo cupom' : `Editar ${editing.code}`}</h2>
          <CouponForm
            key={editing === 'new' ? 'novo' : editing.id}
            {...(editing === 'new' ? {} : { source: editing })}
            onSaved={async (saved) => {
              setNotice(`Cupom ${saved.code} salvo.`);
              setEditing(null);
              await coupons.reload();
            }}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : null}

      {coupons.error ? <Alert kind="error">{coupons.error}</Alert> : null}
      {coupons.loading && !coupons.data ? <Skeleton lines={4} /> : null}
      {coupons.data?.length === 0 ? (
        <Empty>Nenhum cupom ainda. Crie o primeiro em “Novo cupom”.</Empty>
      ) : null}
      {coupons.data && coupons.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Cupom</th>
                <th scope="col">Desconto</th>
                <th scope="col">Validade</th>
                <th scope="col" className="num">
                  Usos
                </th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {coupons.data.map((coupon) => (
                <tr key={coupon.id}>
                  <td data-label="Cupom">
                    <code>{coupon.code}</code>
                    {coupon.description ? (
                      <div className="muted line-clamp-2" style={{ fontWeight: 400 }}>
                        {coupon.description}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Desconto">{describe(coupon)}</td>
                  <td data-label="Validade">
                    {coupon.startsAt || coupon.endsAt
                      ? `${coupon.startsAt ? formatDateTime(coupon.startsAt) : 'agora'} → ${coupon.endsAt ? formatDateTime(coupon.endsAt) : 'sem fim'}`
                      : 'Sem prazo'}
                  </td>
                  <td data-label="Usos" className="num">
                    {coupon.redemptions}
                    {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {formatMoney(coupon.totalDiscount.amount)} em descontos
                    </div>
                  </td>
                  <td data-label="Situação">
                    <span className={`badge ${coupon.isActive ? 'badge-success' : ''}`}>
                      {coupon.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td data-label="Ações">
                    <div className="row" style={{ gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditing(coupon)}
                      >
                        <Icon name="pencil" /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setViewing(coupon)}
                      >
                        <Icon name="receipt" /> Pedidos
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void setActive(coupon)}
                      >
                        {coupon.isActive ? 'Inativar' : 'Reativar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDeleting(coupon)}
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

      {viewing ? (
        <section className="card stack" aria-labelledby="usos">
          <div className="row">
            <h2 id="usos" style={{ margin: 0 }}>
              Pedidos com o cupom {viewing.code}
            </h2>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setViewing(null)}
            >
              Fechar
            </button>
          </div>
          {redemptions.data?.length === 0 ? <Empty>Nenhum pedido usou este cupom.</Empty> : null}
          {redemptions.data && redemptions.data.length > 0 ? (
            <ul>
              {redemptions.data.map((r) => (
                <li key={r.id}>
                  <a href={`/admin/pedidos/${r.orderId}`}>{r.orderNumber}</a> · {r.customerName} · −
                  {formatMoney(r.discountAmount.amount)} · {formatDateTime(r.createdAt)}
                  {r.status === 'RELEASED' ? (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      liberado (pedido cancelado)
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir cupom ${deleting?.code ?? ''}`}
        description="Só cupom nunca usado pode ser excluído. Se já foi usado, inative: o histórico dos pedidos fica preservado."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          await api(`/store/coupons/${deleting?.id ?? ''}`, { method: 'DELETE', body: { reason } });
          setNotice('Cupom excluído.');
          await coupons.reload();
        }}
      />
    </>
  );
}
