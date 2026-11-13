'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

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
import { Icon } from '../../../../components/icon';
import { NewsCard } from '../../../../components/news-card';
import { ImageGalleryManager } from '../../../../components/image-gallery-manager';
import { ImageUpload } from '../../../../components/image-upload';
import { StaleNotice } from '../../../../components/stale-notice';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import {
  NEWS_STATUS,
  type NewsCategory,
  type NewsDetail,
  type NewsTag,
  type TeamEvent
} from '../../../../lib/content-types';
import { formatDateTime } from '../../../../lib/format';
import { useEditableCopy } from '../../../../lib/use-editable-copy';
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
  tagIds: string[];
};

const MAX_TAGS = 5;

export default function NewsEditPage() {
  const { id } = useParams<{ id: string }>();
  const news = useResource<NewsDetail>(`/news/${id}`);
  const categories = useResource<NewsCategory[]>('/news-categories');
  const tags = useResource<NewsTag[]>('/news-tags');
  const events = useResource<Page<TeamEvent>>('/events', { pageSize: 50 });
  const { form, setForm, stale, discard, canUndo, undo } = useEditableCopy<NewsDetail, Form>(
    news.data,
    (n) => ({
      title: n.title,
      slug: n.slug,
      categoryId: n.category.id,
      summary: n.summary ?? '',
      content: n.content,
      eventId: n.event?.id ?? '',
      showOnHome: n.showOnHome,
      showOnForum: n.showOnForum,
      isFeatured: n.isFeatured,
      tagIds: n.tags.map((tag) => tag.id)
    })
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [statusAction, setStatusAction] = useState<'HIDDEN' | 'ARCHIVED' | 'DRAFT' | null>(null);

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
          tagIds: form.tagIds,
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

  if (news.loading && !news.data) {
    return <Loading />;
  }

  if (news.error || !news.data || !form) {
    return <Alert kind="error">{news.error ?? 'Notícia não encontrada.'}</Alert>;
  }

  const n = news.data;
  const status = n.status ?? 'DRAFT';
  // O que deixa a notícia boa de ler e de compartilhar (docs/31, Onda 2). É aviso, não trava.
  const checklist = [
    { label: 'Capa (aparece no cartão e no compartilhamento)', done: n.coverUrl !== null },
    { label: 'Resumo (linha fina abaixo do título)', done: Boolean(n.summary?.trim()) },
    {
      label: 'Categoria ativa',
      done: (categories.data ?? []).some((c) => c.id === n.category.id && c.isActive)
    },
    { label: 'Pelo menos um assunto', done: n.tags.length > 0 }
  ];
  const missing = checklist.filter((item) => !item.done);
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
      <section className="card stack" aria-labelledby="como-vai-aparecer">
        <h2 id="como-vai-aparecer" className="m-0">
          Como vai aparecer
        </h2>
        <div className="news-preview">
          <NewsCard news={n} headingLevel="h3" />
          <div className="stack gap-sm">
            <p className="m-0">
              {missing.length === 0
                ? 'Tudo certo: capa, resumo, categoria e assunto.'
                : n.isPublic
                  ? 'Já está no site. Para ficar mais completa, falta:'
                  : 'Antes de publicar, vale completar o que falta. Dá para publicar mesmo assim.'}
            </p>
            <ul className="list-plain stack gap-sm">
              {checklist.map((item) => (
                <li key={item.label} className={item.done ? 'check-done' : 'check-missing'}>
                  <Icon
                    name={item.done ? 'check-circle-fill' : 'exclamation-circle'}
                    label={item.done ? 'Feito' : 'Falta'}
                  />{' '}
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="muted m-0">A prévia mostra a versão salva.</p>
          </div>
        </div>
      </section>
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
        <StaleNotice stale={stale} onDiscard={discard} canUndo={canUndo} onUndo={undo} />
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
            <legend>Assuntos (até {MAX_TAGS})</legend>
            {(tags.data ?? []).filter((tag) => tag.isActive).length === 0 ? (
              <p className="muted m-0">
                Nenhum assunto cadastrado. Cadastre em Notícias › Assuntos de notícias.
              </p>
            ) : null}
            <div className="row">
              {(tags.data ?? [])
                .filter((tag) => tag.isActive)
                .map((tag) => {
                  const checked = form.tagIds.includes(tag.id);

                  return (
                    <label key={tag.id} className="row gap-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && form.tagIds.length >= MAX_TAGS}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tagIds: e.target.checked
                              ? [...form.tagIds, tag.id]
                              : form.tagIds.filter((id) => id !== tag.id)
                          })
                        }
                      />
                      {tag.name}
                    </label>
                  );
                })}
            </div>
          </fieldset>
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

      <ImageUpload<NewsDetail>
        title="Capa"
        endpoint={`/news/${id}/cover`}
        currentUrl={n.coverUrl}
        recommended="1600 × 900 px (16:9)"
        onUploaded={news.setData}
      />

      <ImageGalleryManager<NewsDetail>
        imagesOf={(detail) => detail.gallery}
        basePath={`/news/${id}/gallery`}
        images={n.gallery}
        onChange={news.setData}
        max={30}
        title="Galeria"
        noun="por notícia"
        intro="Fotos mostradas depois do texto, na ordem daqui. Arraste ou use as setas para ordenar. A descrição vira a legenda e ajuda quem usa leitor de tela."
        emptyText="Nenhuma foto na galeria. A capa continua sendo enviada no bloco acima."
        placeholder="Ex.: bloqueio triplo no tie-break"
        removeDescription="A foto sai da galeria da notícia no site."
      />

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
