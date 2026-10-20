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
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import {
  NEWS_STATUS,
  type NewsCategory,
  type NewsDetail,
  type NewsStatus
} from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

function CategoriesPanel({
  categories,
  reload
}: {
  readonly categories: NewsCategory[];
  readonly reload: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const create = useSubmit(async () => {
    await api('/news-categories', { method: 'POST', body: { name } });
    setName('');
    await reload();
  });
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function toggle(category: NewsCategory) {
    setToggleError(null);

    try {
      await api(`/news-categories/${category.id}`, {
        method: 'PATCH',
        body: { isActive: !category.isActive }
      });
      await reload();
    } catch (caught) {
      setToggleError(errorMessage(caught));
    }
  }

  return (
    <details className="card">
      <summary>Categorias de notícias ({categories.length})</summary>
      {toggleError ? <Alert kind="error">{toggleError}</Alert> : null}
      <ul>
        {categories.map((category) => (
          <li key={category.id} className="row">
            {category.name}
            {category.isActive ? null : <span className="badge">inativa</span>}
            <button type="button" className="btn btn-link" onClick={() => void toggle(category)}>
              {category.isActive ? 'Desativar' : 'Ativar'}
            </button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={(event) => void create.submit(event)}>
        <TextField
          label="Nova categoria"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary" disabled={create.pending}>
          Adicionar
        </button>
      </form>
      <ErrorSummary error={create.error} />
    </details>
  );
}

export default function NewsAdminPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<NewsStatus | ''>('');
  const list = useResource<Page<NewsDetail>>('/news', { page, pageSize: 25, status });
  const categories = useResource<NewsCategory[]>('/news-categories');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', categoryId: '', summary: '', content: '' });
  const create = useSubmit(async () => {
    const created = await api<NewsDetail>('/news', {
      method: 'POST',
      body: {
        title: form.title,
        categoryId: form.categoryId,
        content: form.content,
        ...(form.summary ? { summary: form.summary } : {}),
        showOnHome: true
      }
    });

    router.push(`/admin/noticias/${created.id}`);
  });

  return (
    <>
      <PageHeader
        title="Notícias e comunicados"
        description="Uma notícia alimenta a página inicial e o fórum conforme os canais marcados; ocultar retira de todos."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Fechar' : 'Nova notícia'}
          </button>
        }
      />
      {categories.data ? (
        <CategoriesPanel categories={categories.data} reload={categories.reload} />
      ) : null}
      {creating ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <TextField
              label="Título"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
          </div>
          <TextField
            label="Resumo"
            maxLength={500}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
          <TextArea
            label="Texto"
            required
            rows={8}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            hint="Texto simples; quebras de linha são preservadas. HTML é removido."
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Salvar rascunho
            </button>
          </div>
        </form>
      ) : null}
      <div className="row">
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as NewsStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(NEWS_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhuma notícia.</Empty> : null}
      {list.data && list.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Publicação</th>
                  <th scope="col">Canais</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((news) => (
                  <tr key={news.id}>
                    <td>
                      <Link href={`/admin/noticias/${news.id}`}>{news.title}</Link>
                      {news.isFeatured ? <span className="badge badge-brand">destaque</span> : null}
                    </td>
                    <td>{news.category.name}</td>
                    <td>{formatDateTime(news.publishedAt)}</td>
                    <td>
                      {[news.showOnHome ? 'Início' : null, news.showOnForum ? 'Fórum' : null]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td>
                      {news.status ? (
                        <span className={`badge ${NEWS_STATUS[news.status].badge}`}>
                          {NEWS_STATUS[news.status].label}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={list.data.meta.page}
            pageSize={list.data.meta.pageSize}
            total={list.data.meta.total}
            onChange={setPage}
          />
        </>
      ) : null}
    </>
  );
}
