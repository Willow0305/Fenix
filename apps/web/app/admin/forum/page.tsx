'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  SelectField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import {
  FORUM_VISIBILITY,
  type ForumCategory,
  type ForumReport,
  type ForumVisibility,
  type ModerationAction,
  REPORT_STATUS,
  type ReportStatus
} from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

const ACTION_LABEL: Record<string, string> = {
  HIDE: 'Ocultou',
  RESTORE: 'Restaurou',
  CLOSE: 'Fechou',
  REOPEN: 'Reabriu',
  DELETE: 'Removeu',
  EDIT: 'Fixou/desafixou'
};

function Categories() {
  const categories = useResource<ForumCategory[]>('/forum/admin/categories');
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'PUBLIC' as ForumVisibility
  });
  const [error, setError] = useState<string | null>(null);
  const create = useSubmit(async () => {
    await api('/forum/admin/categories', { method: 'POST', body: form });
    setForm({ name: '', description: '', visibility: 'PUBLIC' });
    await categories.reload();
  });

  async function update(id: string, body: Record<string, unknown>) {
    setError(null);

    try {
      await api(`/forum/admin/categories/${id}`, { method: 'PATCH', body });
      await categories.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <section className="card stack" aria-labelledby="categorias">
      <h2 id="categorias">Categorias</h2>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {categories.data?.map((category) => (
        <div key={category.id} className="row">
          <Link href={`/forum/${category.slug}`}>{category.name}</Link>
          <span className="muted">{category.topicCount} tópico(s)</span>
          {category.isActive ? null : <span className="badge">inativa</span>}
          <span className="spacer" />
          <label className="field">
            <span className="visually-hidden">Visibilidade de {category.name}</span>
            <select
              value={category.visibility}
              onChange={(e) => void update(category.id, { visibility: e.target.value })}
            >
              {Object.entries(FORUM_VISIBILITY).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-link"
            onClick={() => void update(category.id, { isActive: !category.isActive })}
          >
            {category.isActive ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      ))}
      <form className="form" onSubmit={(event) => void create.submit(event)}>
        <ErrorSummary error={create.error} />
        <div className="form-grid">
          <TextField
            label="Nova categoria"
            maxLength={120}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Descrição"
            maxLength={1000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <SelectField
            label="Visibilidade"
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value as ForumVisibility })}
            options={Object.entries(FORUM_VISIBILITY).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary" disabled={create.pending}>
            Criar categoria
          </button>
        </div>
      </form>
    </section>
  );
}

function Reports() {
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN');
  const [page, setPage] = useState(1);
  const reports = useResource<Page<ForumReport>>('/forum/reports', { status, page, pageSize: 20 });
  const [review, setReview] = useState<{
    report: ForumReport;
    status: 'RESOLVED' | 'DISMISSED';
  } | null>(null);

  return (
    <section className="card stack" aria-labelledby="denuncias">
      <div className="row">
        <h2 id="denuncias" style={{ margin: 0 }}>
          Denúncias
        </h2>
        <span className="spacer" />
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as ReportStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(REPORT_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {reports.error ? <Alert kind="error">{reports.error}</Alert> : null}
      {reports.loading && !reports.data ? <Loading /> : null}
      {reports.data?.data.length === 0 ? <Empty>Nenhuma denúncia.</Empty> : null}
      {reports.data?.data.map((report) => (
        <article
          key={report.id}
          className="stack"
          style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}
        >
          <div className="row">
            <span className={`badge ${REPORT_STATUS[report.status].badge}`}>
              {REPORT_STATUS[report.status].label}
            </span>
            <strong>{report.reason}</strong>
            <small className="muted">
              por {report.reporter} · {formatDateTime(report.createdAt)}
            </small>
          </div>
          {report.topicId ? (
            <span>
              {report.target === 'POST' ? 'Mensagem em ' : 'Tópico '}
              <Link href={`/forum/topicos/${report.topicId}`}>{report.topicTitle}</Link>
            </span>
          ) : null}
          {report.excerpt ? (
            <blockquote className="prose muted">{report.excerpt}</blockquote>
          ) : null}
          {report.details ? <p style={{ margin: 0 }}>{report.details}</p> : null}
          {report.resolution ? <small>Decisão: {report.resolution}</small> : null}
          {report.status === 'OPEN' || report.status === 'UNDER_REVIEW' ? (
            <div className="row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReview({ report, status: 'RESOLVED' })}
              >
                Concluir
              </button>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setReview({ report, status: 'DISMISSED' })}
              >
                Descartar
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {reports.data ? (
        <Pagination
          page={reports.data.meta.page}
          pageSize={reports.data.meta.pageSize}
          total={reports.data.meta.total}
          onChange={setPage}
        />
      ) : null}
      <ConfirmDialog
        open={review !== null}
        title={review?.status === 'RESOLVED' ? 'Concluir denúncia' : 'Descartar denúncia'}
        description="Modere o conteúdo pelo próprio tópico antes de concluir. Descreva a decisão."
        confirmLabel="Registrar"
        requireReason
        onClose={() => setReview(null)}
        onConfirm={async (resolution) => {
          await api(`/forum/reports/${review?.report.id ?? ''}`, {
            method: 'PUT',
            body: { status: review?.status, resolution }
          });
          await reports.reload();
        }}
      />
    </section>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const history = useResource<Page<ModerationAction>>('/forum/moderation-actions', {
    page,
    pageSize: 20
  });

  return (
    <section className="card stack" aria-labelledby="historico">
      <h2 id="historico">Histórico de moderação</h2>
      {history.data?.data.length === 0 ? <Empty>Nenhuma ação registrada.</Empty> : null}
      {history.data && history.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">Moderador</th>
                <th scope="col">Ação</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {history.data.data.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.moderator}</td>
                  <td>
                    {ACTION_LABEL[item.action] ?? item.action}{' '}
                    {item.topicId ? (
                      <Link href={`/forum/topicos/${item.topicId}`}>
                        {item.postId ? 'mensagem' : 'tópico'}
                      </Link>
                    ) : null}
                  </td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {history.data ? (
        <Pagination
          page={history.data.meta.page}
          pageSize={history.data.meta.pageSize}
          total={history.data.meta.total}
          onChange={setPage}
        />
      ) : null}
    </section>
  );
}

export default function ForumAdminPage() {
  return (
    <>
      <PageHeader
        title="Fórum e moderação"
        description="Ocultar, remover, fechar e fixar são feitos no próprio tópico, sempre com motivo. Nada é apagado do histórico."
      />
      <Reports />
      <Categories />
      <History />
    </>
  );
}
