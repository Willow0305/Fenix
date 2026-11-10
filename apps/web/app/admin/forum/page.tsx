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
  Skeleton,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import {
  ForumSanctionDialog,
  type SanctionTarget
} from '../../../components/forum-sanction-dialog';
import { api, errorMessage } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import {
  FORUM_VISIBILITY,
  type ForumCategory,
  type ForumReport,
  type ForumRules,
  type ForumSanction,
  type ForumVisibility,
  type ModerationAction,
  REPORT_STATUS,
  type ReportStatus
} from '../../../lib/content-types';
import { formatDateTime, plural } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';
import { CategoryManager } from '../../../components/category-manager';
import { Icon } from '../../../components/icon';

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
      <CategoryManager
        items={(categories.data ?? []).map((category) => ({
          ...category,
          detail: `${plural(category.topicCount, 'tópico', 'tópicos')}`
        }))}
        endpoint="/forum/admin/categories"
        manage
        onChanged={categories.reload}
        rowExtra={(category) => (
          <>
            <Link href={`/forum/${category.slug}`}>
              <Icon name="box-arrow-up-right" /> Ver
            </Link>
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
          </>
        )}
      />
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
  const [sanction, setSanction] = useState<SanctionTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section className="card stack" aria-labelledby="denuncias">
      <div className="row">
        <h2 id="denuncias" className="m-0">
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
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {reports.error ? <Alert kind="error">{reports.error}</Alert> : null}
      {reports.loading && !reports.data ? <Loading /> : null}
      {reports.data?.data.length === 0 ? <Empty>Nenhuma denúncia.</Empty> : null}
      {reports.data?.data.map((report) => (
        <article key={report.id} className="stack border-b pb-md">
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
          {report.details ? <p className="m-0">{report.details}</p> : null}
          {report.resolution ? <small>Decisão: {report.resolution}</small> : null}
          {report.author ? <small className="muted">Escrito por {report.author.name}</small> : null}
          {report.status === 'OPEN' || report.status === 'UNDER_REVIEW' ? (
            <div className="row">
              {report.author ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setSanction({
                      userId: report.author?.id ?? '',
                      name: report.author?.name ?? '',
                      topicId: report.topicId,
                      postId: report.postId
                    })
                  }
                >
                  <Icon name="exclamation-triangle" /> Advertir ou suspender
                </button>
              ) : null}
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
          noun={['denúncia', 'denúncias']}
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
      <ForumSanctionDialog
        target={sanction}
        onClose={() => setSanction(null)}
        onDone={(message) => setNotice(message)}
      />
    </section>
  );
}

/**
 * Advertências e suspensões (DT-108): em vigor primeiro; liberar pede motivo e avisa a
 * pessoa. Nada é apagado.
 */
function Sanctions() {
  const [onlyActive, setOnlyActive] = useState(true);
  const [page, setPage] = useState(1);
  const list = useResource<Page<ForumSanction>>('/forum/admin/sanctions', {
    active: onlyActive ? 'true' : undefined,
    page,
    pageSize: 20
  });
  const [lifting, setLifting] = useState<ForumSanction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section className="card stack" aria-labelledby="sancoes">
      <div className="row">
        <h2 id="sancoes" className="m-0">
          Advertências e suspensões
        </h2>
        <span className="spacer" />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(event) => {
              setPage(1);
              setOnlyActive(event.target.checked);
            }}
          />
          <span>Só suspensões em vigor</span>
        </label>
      </div>
      <p className="muted m-0">
        Para advertir ou suspender, use o botão na denúncia ou na mensagem do tópico.
      </p>
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? (
        <Empty>
          {onlyActive ? 'Ninguém está suspenso agora.' : 'Nenhuma advertência ou suspensão ainda.'}
        </Empty>
      ) : null}
      {list.data?.data.map((row) => (
        <article key={row.id} className="stack gap-xs border-b pb-md">
          <div className="row">
            <span
              className={`badge ${row.kind === 'WARNING' ? 'badge-warning' : row.active ? 'badge-danger' : ''}`}
            >
              {row.kind === 'WARNING'
                ? 'Advertência'
                : row.active
                  ? 'Suspensão em vigor'
                  : 'Suspensão encerrada'}
            </span>
            <strong>{row.user.name}</strong>
            <small className="muted">
              por {row.createdBy} · {formatDateTime(row.createdAt)}
            </small>
          </div>
          <span>
            Regra: {row.rule}. {row.reason}
          </span>
          {row.kind === 'SUSPENSION' ? (
            <small className="muted">
              {row.liftedAt
                ? `Liberada por ${row.liftedBy ?? 'diretoria'} em ${formatDateTime(row.liftedAt)}: ${row.liftReason ?? ''}`
                : row.endsAt
                  ? `${row.active ? 'Vale até' : 'Terminou em'} ${formatDateTime(row.endsAt)}`
                  : 'Até a diretoria liberar'}
            </small>
          ) : null}
          {row.topicId ? <Link href={`/forum/topicos/${row.topicId}`}>Ver o tópico</Link> : null}
          {row.active ? (
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLifting(row)}
              >
                Liberar
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {list.data ? (
        <Pagination
          page={list.data.meta.page}
          pageSize={list.data.meta.pageSize}
          total={list.data.meta.total}
          onChange={setPage}
          noun={['registro', 'registros']}
        />
      ) : null}
      <ConfirmDialog
        open={lifting !== null}
        title={`Liberar ${lifting?.user.name ?? ''} no fórum?`}
        description="A pessoa volta a publicar, responder e reagir agora e recebe um aviso. A suspensão continua no histórico."
        confirmLabel="Liberar"
        requireReason
        onClose={() => setLifting(null)}
        onConfirm={async (reason) => {
          await api(`/forum/admin/sanctions/${lifting?.id ?? ''}/lift`, {
            method: 'POST',
            body: { reason }
          });
          setNotice(`${lifting?.user.name ?? 'A pessoa'} foi liberada no fórum.`);
          await list.reload();
        }}
      />
    </section>
  );
}

/** Regras do fórum (DT-108): a diretoria escreve; vazio volta ao texto inicial. */
function RulesEditor() {
  const rules = useResource<ForumRules>('/forum/rules');
  const [text, setText] = useState<string | null>(null);
  const save = useSubmit(async () => {
    rules.setData(
      await api<ForumRules>('/forum/admin/rules', { method: 'PUT', body: { text: text ?? '' } })
    );
    setText(null);
    save.setMessage('Regras salvas. A página Regras do fórum já mostra o texto novo.');
  });

  if (!rules.data) {
    return rules.error ? <Alert kind="error">{rules.error}</Alert> : <Skeleton lines={3} />;
  }

  return (
    <form className="form card" onSubmit={(event) => void save.submit(event)}>
      <h2>Regras do fórum</h2>
      <p className="muted m-0">
        Aparecem em <Link href="/forum/regras">Regras do fórum</Link> e no aviso de advertência. As
        linhas numeradas, como &quot;1. Respeito: …&quot;, viram as sugestões de &quot;regra
        quebrada&quot;.
        {rules.data.custom ? '' : ' Hoje está o texto inicial do sistema: revise antes de usar.'}
      </p>
      {save.message ? <Alert kind="success">{save.message}</Alert> : null}
      <ErrorSummary error={save.error} />
      <TextArea
        label="Texto das regras"
        hint="Deixe em branco e salve para voltar ao texto inicial."
        maxLength={20000}
        rows={12}
        value={text ?? rules.data.text}
        onChange={(event) => setText(event.target.value)}
        error={save.fieldError('text')}
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          {save.pending ? 'Salvando…' : 'Salvar regras'}
        </button>
      </div>
    </form>
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
          <table className="table table-stack">
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
                  <td data-label="Quando">{formatDateTime(item.createdAt)}</td>
                  <td data-label="Moderador">{item.moderator}</td>
                  <td data-label="Ação">
                    {ACTION_LABEL[item.action] ?? item.action}{' '}
                    {item.topicId ? (
                      <Link href={`/forum/topicos/${item.topicId}`}>
                        {item.postId ? 'mensagem' : 'tópico'}
                      </Link>
                    ) : null}
                  </td>
                  <td data-label="Motivo">{item.reason}</td>
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
          noun={['ação de moderação', 'ações de moderação']}
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
        description="Denúncias, advertências e suspensões, regras e categorias. Ocultar, fechar ou fixar é feito no próprio tópico."
      />
      <Reports />
      <Sanctions />
      <RulesEditor />
      <Categories />
      <History />
    </>
  );
}
