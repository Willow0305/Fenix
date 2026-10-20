'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  Pagination,
  TextArea,
  TextField,
  useSubmit
} from '../../../../../components/ui';
import { api, errorMessage } from '../../../../../lib/api-client';
import { useAuth } from '../../../../../lib/auth-context';
import {
  type ForumPost,
  REACTIONS,
  type ReactionType,
  type TopicDetail
} from '../../../../../lib/content-types';
import { formatDateTime } from '../../../../../lib/format';
import { useResource } from '../../../../../lib/use-resource';

type Moderation =
  | { kind: 'topic'; action: 'HIDE' | 'RESTORE' | 'CLOSE' | 'REOPEN' | 'PIN' | 'UNPIN' }
  | { kind: 'post'; postId: string; action: 'HIDE' | 'RESTORE' | 'DELETE' };

const ACTION_LABEL: Record<string, string> = {
  HIDE: 'Ocultar',
  RESTORE: 'Restaurar',
  CLOSE: 'Fechar',
  REOPEN: 'Reabrir',
  PIN: 'Fixar',
  UNPIN: 'Desafixar',
  DELETE: 'Remover'
};

function PostItem({
  post,
  canModerate,
  authenticated,
  onChanged,
  onModerate,
  onReport
}: {
  readonly post: ForumPost;
  readonly canModerate: boolean;
  readonly authenticated: boolean;
  readonly onChanged: () => Promise<void>;
  readonly onModerate: (m: Moderation) => void;
  readonly onReport: (postId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useSubmit(async () => {
    await api(`/forum/posts/${post.id}`, { method: 'PATCH', body: { content: text } });
    setEditing(false);
    await onChanged();
  });

  async function run(action: () => Promise<unknown>) {
    setError(null);

    try {
      await action();
      await onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const react = (type: ReactionType) =>
    run(() =>
      post.myReaction === type
        ? api(`/forum/posts/${post.id}/reaction`, { method: 'DELETE' })
        : api(`/forum/posts/${post.id}/reaction`, { method: 'PUT', body: { type } })
    );

  return (
    <article
      className="card stack"
      aria-label={`Mensagem de ${post.author?.name ?? 'conta removida'}`}
    >
      <div className="row">
        <strong>{post.author?.name ?? 'Conta removida'}</strong>
        <small className="muted">
          {formatDateTime(post.createdAt)}
          {post.editedAt ? ' · editada' : ''}
        </small>
        {post.status === 'HIDDEN' ? (
          <span className="badge badge-warning">oculta pela moderação</span>
        ) : null}
      </div>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {post.content === null ? (
        <p className="muted" style={{ margin: 0 }}>
          {post.status === 'DELETED' ? 'Mensagem removida.' : 'Mensagem indisponível.'}
        </p>
      ) : editing ? (
        <form className="form" onSubmit={(event) => void save.submit(event)}>
          <ErrorSummary error={save.error} />
          <TextArea
            label="Editar mensagem"
            required
            maxLength={10000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
              Salvar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <p className="prose" style={{ margin: 0 }}>
          {post.content}
        </p>
      )}
      {post.status === 'PUBLISHED' ? (
        <div className="row">
          {(Object.keys(REACTIONS) as ReactionType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`btn btn-sm ${post.myReaction === type ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={post.myReaction === type}
              disabled={!authenticated}
              onClick={() => void react(type)}
            >
              <span aria-hidden="true">{REACTIONS[type].icon}</span> {REACTIONS[type].label}{' '}
              {post.reactions[type] > 0 ? `(${post.reactions[type]})` : ''}
            </button>
          ))}
          <span className="spacer" />
          {post.canEdit && !editing ? (
            <>
              <button type="button" className="btn btn-link" onClick={() => setEditing(true)}>
                Editar
              </button>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => void run(() => api(`/forum/posts/${post.id}`, { method: 'DELETE' }))}
              >
                Apagar
              </button>
            </>
          ) : null}
          {authenticated && !post.canEdit ? (
            <button type="button" className="btn btn-link" onClick={() => onReport(post.id)}>
              Denunciar
            </button>
          ) : null}
        </div>
      ) : null}
      {canModerate && post.status !== 'DELETED' ? (
        <div className="row">
          <small className="muted">Moderação:</small>
          {(post.status === 'PUBLISHED'
            ? (['HIDE', 'DELETE'] as const)
            : (['RESTORE', 'DELETE'] as const)
          ).map((action) => (
            <button
              key={action}
              type="button"
              className="btn btn-link"
              onClick={() => onModerate({ kind: 'post', postId: post.id, action })}
            >
              {ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useAuth();
  const [page, setPage] = useState(1);
  const topic = useResource<TopicDetail>(status === 'loading' ? null : `/forum/topics/${id}`, {
    page
  });
  const [reply, setReply] = useState('');
  const [moderation, setModeration] = useState<Moderation | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const send = useSubmit(async () => {
    await api(`/forum/topics/${id}/posts`, { method: 'POST', body: { content: reply } });
    setReply('');
    await topic.reload();
  });

  if (topic.loading && !topic.data) {
    return <Loading />;
  }

  if (topic.error || !topic.data) {
    return (
      <div className="container" style={{ paddingTop: '2rem' }}>
        <Alert kind="error">{topic.error ?? 'Tópico não encontrado.'}</Alert>
        <Link href="/forum">← Fórum</Link>
      </div>
    );
  }

  const t = topic.data;
  const topicActions: Extract<Moderation, { kind: 'topic' }>['action'][] = [
    ...(t.status === 'HIDDEN' ? (['RESTORE'] as const) : (['HIDE'] as const)),
    ...(t.status === 'PUBLISHED' ? (['CLOSE'] as const) : []),
    ...(t.status === 'CLOSED' ? (['REOPEN'] as const) : []),
    ...(t.isPinned ? (['UNPIN'] as const) : (['PIN'] as const))
  ];

  return (
    <div className="container stack" style={{ paddingTop: '2rem', maxWidth: '52rem' }}>
      <p>
        <Link href={`/forum/${t.category.slug}`}>← {t.category.name}</Link>
      </p>
      <div className="row">
        <h1 style={{ margin: 0 }}>{t.title}</h1>
        {t.isPinned ? <span className="badge badge-brand">Fixado</span> : null}
        {t.status === 'CLOSED' ? <span className="badge">Fechado</span> : null}
        {t.status === 'HIDDEN' ? <span className="badge badge-warning">Oculto</span> : null}
      </div>
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {t.canModerate ? (
        <div className="card row">
          <small className="muted">Moderar tópico:</small>
          {topicActions.map((action) => (
            <button
              key={action}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setModeration({ kind: 'topic', action })}
            >
              {ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      ) : null}

      {t.posts.data.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          canModerate={t.canModerate}
          authenticated={status === 'authenticated'}
          onChanged={topic.reload}
          onModerate={setModeration}
          onReport={(postId) => {
            setReportReason('');
            setReporting(postId);
          }}
        />
      ))}
      <Pagination
        page={t.posts.meta.page}
        pageSize={t.posts.meta.pageSize}
        total={t.posts.meta.total}
        onChange={setPage}
      />

      {t.canReply ? (
        <form className="form card" onSubmit={(event) => void send.submit(event)}>
          <ErrorSummary error={send.error} />
          <TextArea
            label="Responder"
            required
            rows={4}
            maxLength={10000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            hint="Seja respeitoso. Não publique dados pessoais, de saúde ou de menores."
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={send.pending}>
              Enviar
            </button>
          </div>
        </form>
      ) : status === 'anonymous' ? (
        <p>
          <Link href={`/entrar?next=/forum/topicos/${id}`}>Entre</Link> para responder.
        </p>
      ) : t.status !== 'PUBLISHED' ? (
        <p className="muted">Este tópico não aceita novas mensagens.</p>
      ) : null}

      <ConfirmDialog
        open={moderation !== null}
        title={
          moderation
            ? `${ACTION_LABEL[moderation.action]} ${moderation.kind === 'topic' ? 'tópico' : 'mensagem'}`
            : ''
        }
        description="A ação e o motivo ficam no histórico de moderação; o autor é avisado quando o conteúdo é ocultado ou removido."
        confirmLabel="Confirmar"
        danger={moderation?.action === 'DELETE' || moderation?.action === 'HIDE'}
        requireReason
        onClose={() => setModeration(null)}
        onConfirm={async (reason) => {
          if (!moderation) {
            return;
          }

          await api(
            moderation.kind === 'topic'
              ? `/forum/topics/${id}/moderation`
              : `/forum/posts/${moderation.postId}/moderation`,
            { method: 'POST', body: { action: moderation.action, reason } }
          );
          await topic.reload();
        }}
      />
      <ConfirmDialog
        open={reporting !== null}
        title="Denunciar mensagem"
        description="A denúncia vai somente para a moderação. Quem escreveu não sabe quem denunciou."
        confirmLabel="Enviar denúncia"
        onClose={() => setReporting(null)}
        onConfirm={async () => {
          await api('/forum/reports', {
            method: 'POST',
            body: { postId: reporting, reason: reportReason }
          });
          setNotice('Denúncia enviada. Obrigado por ajudar a manter o fórum saudável.');
        }}
      >
        <TextField
          label="Motivo"
          required
          minLength={3}
          maxLength={180}
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
