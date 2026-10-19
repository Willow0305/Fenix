'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { formatDateTime, formatMoney } from '../../../../lib/format';
import { normalizeAmount } from '../../../../lib/idempotency';
import {
  FULFILLMENT,
  type Fulfillment,
  PRODUCT_STATUS,
  type ProductDetail,
  type ProductStatus,
  type StoreCategory,
  type Variant
} from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';
import type { Page } from '../../../../lib/api-types';
import { COMMISSION_TYPE, type Partner } from '../../../../lib/partner-types';

interface Movement {
  id: string;
  type: string;
  quantityDelta: number;
  reason: string | null;
  occurredAt: string;
  createdBy: string | null;
}

const MOVEMENT_LABEL: Record<string, string> = {
  STOCK_IN: 'Entrada',
  STOCK_OUT: 'Venda',
  RESERVATION: 'Reserva',
  RELEASE: 'Liberação',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolução',
  LOSS: 'Perda'
};

function StockPanel({
  variant,
  onChanged
}: {
  readonly variant: Variant;
  readonly onChanged: () => Promise<void>;
}) {
  const { can } = useAuth();
  const [form, setForm] = useState({ type: 'STOCK_IN', quantity: '', reason: '' });
  const [open, setOpen] = useState(false);
  const movements = useResource<Movement[]>(
    open ? `/store/variants/${variant.id}/movements` : null
  );
  const adjust = useSubmit(async () => {
    await api(`/store/variants/${variant.id}/stock`, {
      method: 'POST',
      body: { type: form.type, quantity: Number(form.quantity), reason: form.reason }
    });
    setForm({ type: 'STOCK_IN', quantity: '', reason: '' });
    await Promise.all([onChanged(), movements.reload()]);
  });

  return (
    <details onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Estoque e movimentações</summary>
      {can('inventory.adjust') ? (
        <form className="row" onSubmit={(event) => void adjust.submit(event)}>
          <SelectField
            label="Movimento"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: 'STOCK_IN', label: 'Entrada' },
              { value: 'LOSS', label: 'Perda/avaria' },
              { value: 'ADJUSTMENT', label: 'Ajuste (+/−)' }
            ]}
          />
          <TextField
            label="Quantidade"
            type="number"
            required
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <TextField
            label="Motivo"
            required
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={adjust.pending}>
            Registrar
          </button>
          <ErrorSummary error={adjust.error} />
        </form>
      ) : null}
      <ul>
        {(movements.data ?? []).map((m) => (
          <li key={m.id}>
            {formatDateTime(m.occurredAt)} — {MOVEMENT_LABEL[m.type] ?? m.type}{' '}
            {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
            {m.reason ? ` · ${m.reason}` : ''}
            {m.createdBy ? ` · ${m.createdBy}` : ''}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ProductAdminPage() {
  const { id } = useParams<{ id: string }>();
  const product = useResource<ProductDetail>(`/store/products/${id}`);
  const categories = useResource<StoreCategory[]>('/store/categories');
  const { can } = useAuth();
  const partners = useResource<Page<Partner>>(can('partners.manage') ? '/partners' : null, {
    pageSize: 100
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [variant, setVariant] = useState({
    name: '',
    size: '',
    color: '',
    priceOverride: '',
    sku: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');

  useEffect(() => {
    const p = product.data;

    if (p) {
      setForm({
        name: p.name,
        categoryId: p.category.id,
        fulfillmentType: p.fulfillmentType,
        basePrice: p.basePrice?.amount ?? p.listPriceFrom.amount,
        promotionalPrice: p.promotionalPrice?.amount ?? '',
        costPrice: p.costPrice?.amount ?? '',
        brand: p.brand ?? '',
        description: p.description ?? '',
        buyerLimit: p.buyerLimit ? String(p.buyerLimit) : '',
        productionLeadDays: p.productionLeadDays ? String(p.productionLeadDays) : '',
        pickupInstructions: p.pickupInstructions ?? '',
        isFeatured: p.isFeatured ? 'true' : 'false',
        partnerId: p.partner?.id ?? '',
        commissionTypeOverride: p.commissionOverride?.type ?? '',
        commissionPercentageOverride: p.commissionOverride?.percentage ?? '',
        commissionFixedOverride: p.commissionOverride?.fixedAmount?.amount ?? ''
      });
    }
  }, [product.data]);

  const save = useSubmit(async () => {
    product.setData(
      await api<ProductDetail>(`/store/products/${id}`, {
        method: 'PATCH',
        body: {
          name: form['name'],
          categoryId: form['categoryId'],
          fulfillmentType: form['fulfillmentType'],
          basePrice: normalizeAmount(form['basePrice'] ?? ''),
          promotionalPrice: form['promotionalPrice']
            ? normalizeAmount(form['promotionalPrice'])
            : '',
          costPrice: form['costPrice'] ? normalizeAmount(form['costPrice']) : '',
          brand: form['brand'] ?? '',
          description: form['description'] ?? '',
          buyerLimit: form['buyerLimit'] ? Number(form['buyerLimit']) : 0,
          ...(form['productionLeadDays']
            ? { productionLeadDays: Number(form['productionLeadDays']) }
            : {}),
          pickupInstructions: form['pickupInstructions'] ?? '',
          isFeatured: form['isFeatured'] === 'true',
          partnerId: form['partnerId'] ?? '',
          commissionTypeOverride: form['partnerId'] ? (form['commissionTypeOverride'] ?? '') : '',
          ...(form['partnerId'] && form['commissionTypeOverride'] === 'PERCENTAGE'
            ? {
                commissionPercentageOverride: normalizeAmount(
                  form['commissionPercentageOverride'] ?? ''
                )
              }
            : {}),
          ...(form['partnerId'] && form['commissionTypeOverride'] === 'FIXED'
            ? { commissionFixedOverride: normalizeAmount(form['commissionFixedOverride'] ?? '') }
            : {})
        }
      })
    );
    setNotice('Produto salvo.');
  });
  const addVariant = useSubmit(async () => {
    product.setData(
      await api<ProductDetail>(`/store/products/${id}/variants`, {
        method: 'POST',
        body: {
          name: variant.name,
          ...(variant.size ? { size: variant.size } : {}),
          ...(variant.color ? { color: variant.color } : {}),
          ...(variant.sku ? { sku: variant.sku } : {}),
          ...(variant.priceOverride
            ? { priceOverride: normalizeAmount(variant.priceOverride) }
            : {})
        }
      })
    );
    setVariant({ name: '', size: '', color: '', priceOverride: '', sku: '' });
  });
  const upload = useSubmit(async () => {
    if (!file) {
      return;
    }

    const body = new FormData();

    body.set('file', file);
    body.set('altText', alt);
    product.setData(
      await api<ProductDetail>(`/store/products/${id}/images`, { method: 'POST', body })
    );
    setFile(null);
    setAlt('');
  });

  async function setStatus(status: ProductStatus, reason?: string) {
    product.setData(
      await api<ProductDetail>(`/store/products/${id}/status`, {
        method: 'PUT',
        body: { status, ...(reason ? { reason } : {}) }
      })
    );
    setNotice(`Situação: ${PRODUCT_STATUS[status].label}.`);
  }

  async function toggleVariant(v: Variant) {
    product.setData(
      await api<ProductDetail>(`/store/products/${id}/variants/${v.id}`, {
        method: 'PATCH',
        body: { isActive: !v.isActive }
      })
    );
  }

  async function removeImage(imageId: string) {
    product.setData(
      await api<ProductDetail>(`/store/products/${id}/images/${imageId}`, { method: 'DELETE' })
    );
  }

  if (!product.data) {
    return product.error ? <Alert kind="error">{product.error}</Alert> : <Loading />;
  }

  const p = product.data;
  const set = (key: string) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <>
      <PageHeader
        title={p.name}
        description={`${FULFILLMENT[p.fulfillmentType]} · ${p.category.name}`}
        actions={
          <>
            {p.status === 'ACTIVE' ? (
              <Link href={`/loja/${p.slug}`} target="_blank">
                Ver na loja
              </Link>
            ) : null}
            <Link href="/admin/produtos">Voltar</Link>
          </>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <section className="card row">
        <span className={`badge ${PRODUCT_STATUS[p.status].badge}`}>
          {PRODUCT_STATUS[p.status].label}
        </span>
        <span className="spacer" />
        {p.status !== 'ACTIVE' && p.status !== 'ARCHIVED' ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void setStatus('ACTIVE').catch((e: Error) => setNotice(e.message))}
          >
            Publicar
          </button>
        ) : null}
        {p.status === 'ACTIVE' ? (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void setStatus('INACTIVE')}
            >
              Ocultar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void setStatus('SOLD_OUT')}
            >
              Marcar esgotado
            </button>
          </>
        ) : null}
        {p.status !== 'ARCHIVED' ? (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setArchiving(true)}
          >
            Excluir
          </button>
        ) : null}
      </section>

      <form className="form card" onSubmit={(event) => void save.submit(event)}>
        <h2>Dados do produto</h2>
        <ErrorSummary error={save.error} />
        <div className="form-grid">
          <TextField label="Nome" required value={form['name'] ?? ''} onChange={set('name')} />
          <SelectField
            label="Categoria"
            value={form['categoryId'] ?? ''}
            onChange={set('categoryId')}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectField
            label="Modo de venda"
            value={form['fulfillmentType'] ?? 'STOCK'}
            onChange={set('fulfillmentType')}
            options={(['STOCK', 'MADE_TO_ORDER', 'CAMPAIGN'] as Fulfillment[]).map((value) => ({
              value,
              label: FULFILLMENT[value]
            }))}
          />
          <TextField
            label="Preço (R$)"
            required
            inputMode="decimal"
            value={form['basePrice'] ?? ''}
            onChange={set('basePrice')}
          />
          <TextField
            label="Preço promocional"
            inputMode="decimal"
            value={form['promotionalPrice'] ?? ''}
            onChange={set('promotionalPrice')}
            hint="Vazio remove a promoção."
          />
          <TextField
            label="Custo (interno)"
            inputMode="decimal"
            value={form['costPrice'] ?? ''}
            onChange={set('costPrice')}
          />
          <TextField label="Marca" value={form['brand'] ?? ''} onChange={set('brand')} />
          <TextField
            label="Limite por comprador"
            type="number"
            min={0}
            value={form['buyerLimit'] ?? ''}
            onChange={set('buyerLimit')}
            hint="Vazio ou 0 = sem limite."
          />
          <TextField
            label="Prazo de produção (dias)"
            type="number"
            min={0}
            value={form['productionLeadDays'] ?? ''}
            onChange={set('productionLeadDays')}
          />
          <SelectField
            label="Destaque na loja"
            value={form['isFeatured'] ?? 'false'}
            onChange={set('isFeatured')}
            options={[
              { value: 'false', label: 'Não' },
              { value: 'true', label: 'Sim' }
            ]}
          />
        </div>
        {partners.data ? (
          <div className="form-grid">
            <SelectField
              label="Parceiro (origem do produto)"
              value={form['partnerId'] ?? ''}
              onChange={set('partnerId')}
              hint="Produto de parceiro só é vendido enquanto o parceiro estiver ativo e no contrato."
              options={[
                { value: '', label: 'Produto próprio do time' },
                ...partners.data.data
                  .filter(
                    (partner) => partner.status !== 'ENDED' || partner.id === form['partnerId']
                  )
                  .map((partner) => ({ value: partner.id, label: partner.displayName }))
              ]}
            />
            {form['partnerId'] ? (
              <SelectField
                label="Comissão deste produto"
                value={form['commissionTypeOverride'] ?? ''}
                onChange={set('commissionTypeOverride')}
                options={[
                  { value: '', label: 'Usar a regra do parceiro' },
                  ...Object.entries(COMMISSION_TYPE).map(([value, label]) => ({ value, label }))
                ]}
              />
            ) : null}
            {form['partnerId'] && form['commissionTypeOverride'] === 'PERCENTAGE' ? (
              <TextField
                label="Percentual (%)"
                inputMode="decimal"
                required
                value={form['commissionPercentageOverride'] ?? ''}
                onChange={set('commissionPercentageOverride')}
              />
            ) : null}
            {form['partnerId'] && form['commissionTypeOverride'] === 'FIXED' ? (
              <TextField
                label="Valor por unidade (R$)"
                inputMode="decimal"
                required
                value={form['commissionFixedOverride'] ?? ''}
                onChange={set('commissionFixedOverride')}
              />
            ) : null}
          </div>
        ) : null}
        <TextArea
          label="Descrição"
          value={form['description'] ?? ''}
          onChange={set('description')}
        />
        <TextArea
          label="Instruções de retirada"
          value={form['pickupInstructions'] ?? ''}
          onChange={set('pickupInstructions')}
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={save.pending}>
            Salvar
          </button>
        </div>
      </form>

      <section className="card stack" aria-labelledby="variacoes">
        <h2 id="variacoes">Variações (tamanho/cor)</h2>
        {p.variants.map((v) => (
          <div
            key={v.id}
            className="stack"
            style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.6rem' }}
          >
            <div className="row">
              <strong>{v.name}</strong>
              <code className="muted">{v.sku}</code>
              <span>{formatMoney(v.price.amount)}</span>
              {p.fulfillmentType === 'STOCK' && v.stock ? (
                <span
                  className={`badge ${v.stock.available <= v.minimumStock ? 'badge-warning' : 'badge-success'}`}
                >
                  {v.stock.available} disponível · {v.stock.reserved} reservado
                </span>
              ) : null}
              {v.isActive ? null : <span className="badge">inativa</span>}
              <span className="spacer" />
              <button type="button" className="btn btn-link" onClick={() => void toggleVariant(v)}>
                {v.isActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
            {p.fulfillmentType === 'STOCK' ? (
              <StockPanel variant={v} onChanged={product.reload} />
            ) : null}
          </div>
        ))}
        <form className="row" onSubmit={(event) => void addVariant.submit(event)}>
          <TextField
            label="Nova variação"
            required
            placeholder="Ex.: M, GG Feminina"
            value={variant.name}
            onChange={(e) => setVariant({ ...variant, name: e.target.value })}
          />
          <TextField
            label="Tamanho"
            value={variant.size}
            onChange={(e) => setVariant({ ...variant, size: e.target.value })}
          />
          <TextField
            label="Cor"
            value={variant.color}
            onChange={(e) => setVariant({ ...variant, color: e.target.value })}
          />
          <TextField
            label="Preço próprio"
            inputMode="decimal"
            value={variant.priceOverride}
            onChange={(e) => setVariant({ ...variant, priceOverride: e.target.value })}
          />
          <TextField
            label="SKU (opcional)"
            value={variant.sku}
            onChange={(e) => setVariant({ ...variant, sku: e.target.value })}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={addVariant.pending}>
            Adicionar
          </button>
          <ErrorSummary error={addVariant.error} />
        </form>
      </section>

      <section className="card stack" aria-labelledby="imagens">
        <h2 id="imagens">Imagens</h2>
        <div className="row">
          {p.images.map((image) => (
            <figure key={image.id} style={{ margin: 0, width: 140 }}>
              <img
                src={image.url}
                alt={image.altText ?? ''}
                style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 6 }}
              />
              <figcaption className="row">
                {image.isPrimary ? <span className="badge badge-brand">principal</span> : null}
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => void removeImage(image.id)}
                >
                  Remover
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
        <form className="row" onSubmit={(event) => void upload.submit(event)}>
          <div className="field">
            <label htmlFor="product-image">Nova imagem (PNG, JPG ou WebP)</label>
            <input
              id="product-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <TextField
            label="Descrição da imagem"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={!file || upload.pending}
          >
            Enviar
          </button>
          <ErrorSummary error={upload.error} />
        </form>
      </section>

      <ConfirmDialog
        open={archiving}
        title="Excluir produto"
        description="O produto sai da loja e da listagem. Pedidos antigos continuam com os dados históricos."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setArchiving(false)}
        onConfirm={async (reason) => setStatus('ARCHIVED', reason)}
      />
    </>
  );
}
