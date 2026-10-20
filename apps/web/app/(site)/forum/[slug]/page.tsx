'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  Pagination,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import type { ForumCategory, TopicDetail, TopicSummary } from '../../../../lib/content-types';
import { formatDateTime } from '../../../../lib/format';
import { useResource } from '../../../../lib/use-resource';

export default function ForumCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { status, can } = useAuth();
  const [page, setPage] = useState(1);
  const data = useResource<{ category: ForumCategory; topics: Page<TopicSummary> }>(
    status === 'loading' ? null : `/forum/categories/${slug}/topics`,
    { page }
  );
  const [form, setForm] = useState({ title: '', content: '', pinned: false });
  const [writing, setWriting] = useState(false);
  const create = useSubmit(async () => {
    const topic = await api<TopicDetail>(`/forum/categories/${slug}/topics`, {
      method: 'POST',
      body: { title: form.title, content: form.content, ...(form.pinned ? { pinned: true } : {}) }
    });

    router.push(`/forum/topicos/${topic.id}`);
  });

  if (data.loading && !data.data) {
    return <Loading />;
  }

  if (data.error || !data.data) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <Alert kind="error">{data.error ?? 'Categoria não encontrada.'}</Alert>
        <Link href="/forum">← Fórum</Link>
      </div>
    );
  }

  const { category, topics } = data.data;

  return (
    <div className="container stack" style={{ paddingTop: '2rem' }}>
      <p>
        <Link href="/forum">← Fórum</Link>
      </p>
      <div className="row">
        <h1 style={{ margin: 0 }}>{category.name}</h1>
        <span className="spacer" />
        {category.canPost ? (
          <button type="button" className="btn btn-primary" onClick={() => setWriting((v) => !v)}>
            {writing ? 'Fechar' : 'Novo tópico'}
          </button>
        ) : status === 'anonymous' ? (
          <Link href={`/entrar?next=/forum/${slug}`} className="btn btn-secondary">
            Entrar para participar
          </Link>
        ) : null}
      </div>
      {category.description ? <p>{category.description}</p> : null}

      {writing ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <ErrorSummary error={create.error} />
          <TextField
            label="Título"
            required
            minLength={3}
            maxLength={180}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextArea
            label="Mensagem"
            required
            rows={6}
            maxLength={10000}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            hint="Texto simples. Não publique dados pessoais, de saúde ou de menores."
          />
          {can('forum.publish') ? (
            <label className="row">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              />
              Comunicado fixado no topo
            </label>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Publicar
            </button>
          </div>
        </form>
      ) : null}

      {topics.data.length === 0 ? <Empty>Nenhum tópico ainda.</Empty> : null}
      {topics.data.length > 0 ? (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
          {topics.data.map((topic) => (
            <li key={topic.id} className="card row">
              {topic.isPinned ? <span className="badge badge-brand">Fixado</span> : null}
              {topic.status === 'CLOSED' ? <span className="badge">Fechado</span> : null}
              {topic.status === 'HIDDEN' ? (
                <span className="badge badge-warning">Oculto</span>
              ) : null}
              <Link href={`/forum/topicos/${topic.id}`}>
                <strong>{topic.title}</strong>
              </Link>
              <span className="spacer" />
              <small className="muted">
                {topic.author ?? 'Conta removida'} · {topic.postCount} mensagem(ns) · última em{' '}
                {formatDateTime(topic.lastActivityAt)}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
      <Pagination
        page={topics.meta.page}
        pageSize={topics.meta.pageSize}
        total={topics.meta.total}
        onChange={setPage}
      />
    </div>
  );
}
