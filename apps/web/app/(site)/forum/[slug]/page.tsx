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
import {
  type ForumCategory,
  replyCount,
  type TopicDetail,
  type TopicSummary
} from '../../../../lib/content-types';
import { plural } from '../../../../lib/format';
import { Avatar } from '../../../../components/avatar';
import { NewsTime } from '../../../../components/news-card';
import { BoardBadge, JoinForumCard, MinorForumNotice } from '../join-forum-card';
import { useResource } from '../../../../lib/use-resource';
import { Icon } from '../../../../components/icon';

export default function ForumCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { status, can, profile } = useAuth();
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
      <div className="container pt-lg">
        <Alert kind="error">{data.error ?? 'Categoria não encontrada.'}</Alert>
        <Link href="/forum" className="back-link">
          <Icon name="chevron-left" /> Fórum
        </Link>
      </div>
    );
  }

  const { category, topics } = data.data;

  return (
    <div className="container stack pt-lg">
      <p>
        <Link href="/forum" className="back-link">
          <Icon name="chevron-left" /> Fórum
        </Link>
      </p>
      <div className="row">
        <h1 className="m-0">{category.name}</h1>
        <span className="spacer" />
        {category.canPost ? (
          <button type="button" className="btn btn-primary" onClick={() => setWriting((v) => !v)}>
            {writing ? 'Fechar' : 'Novo tópico'}
          </button>
        ) : null}
      </div>
      {category.description ? <p className="m-0">{category.description}</p> : null}
      {status === 'anonymous' ? <JoinForumCard next={`/forum/${slug}`} /> : null}
      {profile?.minorAccount ? <MinorForumNotice /> : null}

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

      {topics.data.length === 0 ? (
        <Empty>
          <p className="m-0">Nenhuma conversa aqui ainda.</p>
          {category.canPost && !writing ? (
            <button type="button" className="btn btn-primary" onClick={() => setWriting(true)}>
              Seja o primeiro a abrir um tópico
            </button>
          ) : null}
        </Empty>
      ) : null}
      {topics.data.length > 0 ? (
        <ul className="forum-topics list-plain">
          {topics.data.map((topic) => {
            const replies = replyCount(topic);

            return (
              <li key={topic.id} className={`forum-topic${topic.isPinned ? ' is-pinned' : ''}`}>
                <Avatar src={null} name={topic.author ?? '?'} size={40} />
                <div className="forum-topic-body">
                  <div className="row gap-sm">
                    {topic.isPinned ? (
                      <span className="badge badge-brand">
                        <Icon name="pin-angle-fill" /> Fixado
                      </span>
                    ) : null}
                    {topic.status === 'CLOSED' ? <span className="badge">Fechado</span> : null}
                    {topic.status === 'HIDDEN' ? (
                      <span className="badge badge-warning">Oculto</span>
                    ) : null}
                  </div>
                  <h2 className="forum-topic-title">
                    <Link href={`/forum/topicos/${topic.id}`}>{topic.title}</Link>
                  </h2>
                  <p className="news-meta m-0">
                    <span>
                      {topic.author ?? 'Conta removida'}
                      {topic.authorIsBoard ? <BoardBadge /> : null}
                    </span>
                    <span className="forum-topic-replies">
                      {replies === 0 ? 'sem respostas' : plural(replies, 'resposta', 'respostas')}
                    </span>
                    <span>
                      {replies > 0 && topic.lastAuthor
                        ? `última de ${topic.lastAuthor}, `
                        : 'aberto '}
                      <NewsTime iso={topic.lastActivityAt} />
                    </span>
                  </p>
                </div>
                <span className="forum-topic-count" aria-hidden="true">
                  <strong>{replies}</strong>
                  <span>{replies === 1 ? 'resposta' : 'respostas'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Pagination
        page={topics.meta.page}
        pageSize={topics.meta.pageSize}
        total={topics.meta.total}
        onChange={setPage}
        noun={['tópico', 'tópicos']}
      />
    </div>
  );
}
