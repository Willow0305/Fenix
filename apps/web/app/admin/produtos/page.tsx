'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  SelectField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatMoney } from '../../../lib/format';
import { normalizeAmount } from '../../../lib/idempotency';
import {
  FULFILLMENT,
  type Fulfillment,
  PRODUCT_STATUS,
  type ProductDetail,
  type ProductStatus,
  type StoreCategory
} from '../../../lib/store-types';
import { useResource } from '../../../lib/use-resource';
import { CategoryManager } from '../../../components/category-manager';

export default function ProductsAdminPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const products = useResource<Page<ProductDetail>>('/store/products', {
    page,
    pageSize: 25,
    status,
    search: term,
    kind: 'goods'
  });
  const categories = useResource<StoreCategory[]>('/store/categories');
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState('');
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    fulfillmentType: 'STOCK' as Fulfillment,
    basePrice: ''
  });
  const create = useSubmit(async () => {
    const created = await api<ProductDetail>('/store/products', {
      method: 'POST',
      body: {
        name: form.name,
        categoryId: form.categoryId,
        fulfillmentType: form.fulfillmentType,
        basePrice: normalizeAmount(form.basePrice)
      }
    });

    router.push(`/admin/produtos/${created.id}`);
  });
  const createCategory = useSubmit(async () => {
    await api('/store/categories', { method: 'POST', body: { name: category } });
    setCategory('');
    await categories.reload();
  });

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catálogo, variações, estoque e imagens. Planos de afiliação ficam na aba Afiliação."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Fechar' : 'Novo produto'}
          </button>
        }
      />
      {creating ? (
        <section className="card stack">
          <form className="form" onSubmit={(event) => void create.submit(event)}>
            <h2>Novo produto</h2>
            <ErrorSummary error={create.error} />
            <div className="form-grid">
              <TextField
                label="Nome"
                maxLength={160}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <SelectField
                label="Categoria"
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                options={[
                  { value: '', label: 'Selecione' },
                  ...(categories.data ?? [])
                    .filter((c) => c.isActive)
                    .map((c) => ({ value: c.id, label: c.name }))
                ]}
              />
              <SelectField
                label="Modo de venda"
                value={form.fulfillmentType}
                onChange={(e) =>
                  setForm({ ...form, fulfillmentType: e.target.value as Fulfillment })
                }
                options={(['STOCK', 'MADE_TO_ORDER', 'CAMPAIGN'] as Fulfillment[]).map((value) => ({
                  value,
                  label: FULFILLMENT[value]
                }))}
                hint="Afiliação (carteirinha) tem aba própria: Afiliação → Planos."
              />
              <TextField
                label="Preço (R$)"
                maxLength={16}
                required
                numeric="decimal"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={create.pending}>
                Criar e continuar
              </button>
            </div>
          </form>
          <form className="row" onSubmit={(event) => void createCategory.submit(event)}>
            <TextField
              label="Nova categoria da loja"
              maxLength={120}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!category}>
              Adicionar categoria
            </button>
            <ErrorSummary error={createCategory.error} />
          </form>
        </section>
      ) : null}
      <details className="card">
        <summary>Categorias da loja ({categories.data?.length ?? 0})</summary>
        <CategoryManager
          items={categories.data ?? []}
          endpoint="/store/categories"
          manage
          onChanged={categories.reload}
        />
      </details>
      <form
        className="row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setTerm(search);
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou SKU"
          />
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ProductStatus | '');
            }}
          >
            <option value="">Todas (exceto excluídos)</option>
            {Object.entries(PRODUCT_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>
      {products.error ? <Alert kind="error">{products.error}</Alert> : null}
      {products.loading && !products.data ? <Loading /> : null}
      {products.data?.data.length === 0 ? <Empty>Nenhum produto.</Empty> : null}
      {products.data && products.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Modo</th>
                <th scope="col" className="num">
                  Preço
                </th>
                <th scope="col" className="num">
                  Estoque disponível
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {products.data.data.map((p) => {
                const available = p.variants.reduce(
                  (total, v) => total + (v.stock?.available ?? 0),
                  0
                );
                const low =
                  p.fulfillmentType === 'STOCK' &&
                  p.variants.some(
                    (v) => v.isActive && v.stock && v.stock.available <= v.minimumStock
                  );

                return (
                  <tr key={p.id}>
                    <td data-label="Produto">
                      <Link href={`/admin/produtos/${p.id}`}>{p.name}</Link>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {p.category.name} · {p.variants.length} variação(ões)
                      </div>
                    </td>
                    <td data-label="Modo">{FULFILLMENT[p.fulfillmentType]}</td>
                    <td data-label="Preço" className="num">
                      {formatMoney(p.priceFrom.amount)}
                    </td>
                    <td data-label="Estoque disponível" className="num">
                      {p.fulfillmentType === 'STOCK' ? available : '—'}
                      {low ? (
                        <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                          baixo
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Situação">
                      <span className={`badge ${PRODUCT_STATUS[p.status].badge}`}>
                        {PRODUCT_STATUS[p.status].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {products.data ? <Pagination {...products.data.meta} onChange={setPage} /> : null}
    </>
  );
}
