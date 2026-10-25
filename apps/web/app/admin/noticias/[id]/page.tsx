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
import type { Page } from '../../../../lib/api-types';
import {
  NEWS_STATUS,
  type NewsCategory,
  type NewsDetail,
  type TeamEvent
} from '../../../../lib/content-types';
import { formatDateTime } from '../../../../lib/format';
import { useResource } from '../../../../lib/use-resource';

type Form = {
  title: string;
  slug: string;
  categoryId: string;
  summary: string;
  content: string;
  eventId: string;
  showOnHome: boolean;
  showOnForum: boolean;
  isFeatured: boolean;
};

export default function NewsEditPage() {
  const { id } = useParams<{ id: string }>();
  const news = useResource<NewsDetail>(`/news/${id}`);
  const categories = useResource<NewsCategory[]>('/news-categories');
  const events = useResource<Page<TeamEvent>>('/events', { pageSize: 50 });
  const [form, setForm] = useState<Form | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [statusAction, setStatusAction] = useState<'HIDDEN' | 'ARCHIVED' | 'DRAFT' | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  useEffect(() => {
    const n = news.data;

    if (n) {
      setForm({
        title: n.title,
        slug: n.slug,
        categoryId: n.category.id,
        summary: n.summary ?? '',
        content: n.content,
        eventId: n.event?.id ?? '',
        showOnHome: n.showOnHome,
        showOnForum: n.showOnForum,
        isFeatured: n.isFeatured
      });
    }
  }, [news.data]);

  const save = useSubmit(async () => {
    if (!form || !news.data) {
      return;
    }

    news.setData(
      await api<NewsDetail>(`/news/${id}`, {
        method: 'PATCH',
        body: {
          title: form.title,
          categoryId: form.categoryId,
          summary: form.summary,
          content: form.content,
          eventId: form.eventId,
          showOnHome: form.showOnHome,
          showOnForum: form.showOnForum,
          isFeatured: form.isFeatured,
          ...(form.slug !== news.data.slug ? { slug: form.slug } : {})
        }
      })
    );
    setNotice('Notícia salva. Os canais já exibem a versão atualizada.');
  });
  const publish = useSubmit(async () => {
    news.setData(
      await api<NewsDetail>(`/news/${id}/publish`, {
        method: 'POST',
        body: scheduleAt ? { scheduledAt: new Date(scheduleAt).toISOString() } : {}
      })
    );
    setNotice(scheduleAt ? 'Publicação agendada.' : 'Notícia publicada.');
  });
  const uploadCover = useSubmit(async () => {
    const body = new FormData();

    if (cover) {
      body.append('file', cover);
    }

    news.setData(await api<NewsDetail>(`/news/${id}/cover`, { method: 'POST', body }));
    setCover(null);
  });

  if (news.loading && !news.data) {
    return <Loading />;
  }

  if (news.error || !news.data || !form) {
    return <Alert kind="error">{news.error ?? 'Notícia não encontrada.'}</Alert>;
  }

  const n = news.data;
  const status = n.status ?? 'DRAFT';
  const canPublish = status === 'DRAFT' || status === 'SCHEDULED' || status === 'HIDDEN';
  const check = (key: 'showOnHome' | 'showOnForum' | 'isFeatured', label: string) => (
    <label className="row">
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
      />
      {label}
    </label>
  );

  return (
    <>
      <PageHeader
        title={n.title}
        description={`Endereço: /noticias/${n.slug}`}
        actions={
          n.isPublic ? (
            <Link href={`/noticias/${n.slug}`} className="btn btn-secondary" target="_blank">
              Ver no site
            </Link>
          ) : undefined
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <section className="card stack" aria-label="Publicação">
        <div className="row">
          <span className={`badge ${NEWS_STATUS[status].badge}`}>{NEWS_STATUS[status].label}</span>
          {n.publishedAt ? (
            <span className="muted">
              {status === 'SCHEDULED' && !n.isPublic ? 'Agendada para' : 'Publicada em'}{' '}
              {formatDateTime(n.publishedAt)}
            </span>
          ) : null}
          <span className="spacer" />
          {status === 'PUBLISHED' || status === 'SCHEDULED' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStatusAction('HIDDEN')}
            >
              Ocultar
            </button>
          ) : null}
          {status === 'SCHEDULED' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStatusAction('DRAFT')}
            >
              Cancelar agendamento
            </button>
          ) : null}
          {status !== 'ARCHIVED' ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setStatusAction('ARCHIVED')}
            >
              Arquivar
            </button>
          ) : null}
        </div>
        {canPublish ? (
          <form className="row" onSubmit={(event) => void publish.submit(event)}>
            <TextField
              label="Agendar para (opcional)"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              hint="Vazio publica agora. Horário do seu dispositivo; armazenado em UTC."
            />
            <button type="submit" className="btn btn-primary" disabled={publish.pending}>
              {scheduleAt ? 'Agendar' : 'Publicar agora'}
            </button>
          </form>
        ) : null}
        <ErrorSummary error={publish.error} />
      </section>

      <form className="form card" onSubmit={(event) => void save.submit(event)}>
        <h2>Conteúdo</h2>
        <ErrorSummary error={save.error} />
        <fieldset disabled={status === 'ARCHIVED'} className="stack">
          <div className="form-grid">
            <TextField
              label="Título"
              maxLength={180}
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              label="Endereço (slug)"
              maxLength={180}
              required
              value={form.slug}
              disabled={n.publishedAt !== null}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              hint={
                n.publishedAt ? 'Fixo após a publicação.' : 'Letras minúsculas, números e hífens.'
              }
            />
            <SelectField
              label="Categoria"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              label="Evento relacionado"
              value={form.eventId}
              onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              options={[
                { value: '', label: 'Nenhum' },
                ...(events.data?.data ?? []).map((ev) => ({
                  value: ev.id,
                  label: `${ev.title} — ${formatDateTime(ev.startsAt)}`
                }))
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
            maxLength={50000}
            required
            rows={12}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            hint="Texto simples; quebras de linha são preservadas."
          />
          <fieldset className="stack">
            <legend>Canais</legend>
            {check('showOnHome', 'Página inicial')}
            {check('showOnForum', 'Comunicados do fórum')}
            {check('isFeatured', 'Destaque (aparece primeiro na página inicial)')}
          </fieldset>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              Salvar
            </button>
          </div>
        </fieldset>
      </form>

      <form className="form card" onSubmit={(event) => void uploadCover.submit(event)}>
        <h2>Capa</h2>
        <ErrorSummary error={uploadCover.error} />
        {n.coverUrl ? <img src={n.coverUrl} alt="" style={{ maxWidth: '24rem' }} /> : null}
        <div className="row">
          <TextField
            label="Imagem (PNG, JPG ou WebP, até 5 MB)"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
          <button type="submit" className="btn btn-secondary" disabled={uploadCover.pending}>
            Enviar capa
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={statusAction !== null}
        title={
          statusAction === 'HIDDEN'
            ? 'Ocultar notícia'
            : statusAction === 'DRAFT'
              ? 'Voltar a rascunho'
              : 'Arquivar notícia'
        }
        description="A notícia sai de todos os canais (página inicial, notícias e fórum)."
        confirmLabel="Confirmar"
        danger={statusAction !== 'DRAFT'}
        requireReason={statusAction === 'HIDDEN'}
        onClose={() => setStatusAction(null)}
        onConfirm={async (reason) => {
          news.setData(
            await api<NewsDetail>(`/news/${id}/status`, {
              method: 'PUT',
              body: { status: statusAction, ...(reason ? { reason } : {}) }
            })
          );
        }}
      />
    </>
  );
}
