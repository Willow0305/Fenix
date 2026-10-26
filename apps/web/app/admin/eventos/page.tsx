'use client';

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
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { ImageUpload } from '../../../components/image-upload';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import {
  EVENT_STATUS,
  EVENT_TYPE,
  type EventStatus,
  type EventType,
  scoreLabel,
  type TeamEvent
} from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';
import { teamOptions } from '../../../lib/team-options';

interface Team {
  id: string;
  name: string;
}

interface Tryout {
  id: string;
  title: string;
}

const NEXT: Record<EventStatus, { status: EventStatus; label: string }[]> = {
  DRAFT: [
    { status: 'SCHEDULED', label: 'Confirmar e publicar' },
    { status: 'CANCELLED', label: 'Cancelar' }
  ],
  SCHEDULED: [
    { status: 'COMPLETED', label: 'Marcar como realizado' },
    { status: 'DRAFT', label: 'Voltar a rascunho' },
    { status: 'CANCELLED', label: 'Cancelar' }
  ],
  CANCELLED: [{ status: 'SCHEDULED', label: 'Reativar' }],
  COMPLETED: []
};

function toLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

type Form = {
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  locationName: string;
  address: string;
  description: string;
  isPublic: boolean;
  tryoutId: string;
  opponentName: string;
  competitionName: string;
  isHome: boolean;
  teamId: string;
  teamScore: string;
  opponentScore: string;
};

const EMPTY: Form = {
  title: '',
  type: 'MATCH',
  startsAt: '',
  endsAt: '',
  locationName: '',
  address: '',
  description: '',
  isPublic: true,
  tryoutId: '',
  opponentName: '',
  competitionName: '',
  isHome: true,
  teamId: '',
  teamScore: '',
  opponentScore: ''
};

function fromEvent(event: TeamEvent): Form {
  return {
    title: event.title,
    type: event.type,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    locationName: event.locationName ?? '',
    address: event.address ?? '',
    description: event.description ?? '',
    isPublic: event.isPublic,
    tryoutId: event.tryout?.id ?? '',
    opponentName: event.match?.opponentName ?? '',
    competitionName: event.match?.competitionName ?? '',
    isHome: event.match?.isHome ?? true,
    teamId: event.match?.team?.id ?? '',
    teamScore: event.match?.teamScore?.toString() ?? '',
    opponentScore: event.match?.opponentScore?.toString() ?? ''
  };
}

function EventForm({
  initial,
  editingId,
  onSaved
}: {
  readonly initial: Form;
  readonly editingId: string | null;
  readonly onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<Form>(initial);
  const teams = useResource<Team[]>('/teams');
  const tryouts = useResource<Page<Tryout>>('/tryouts', { scope: 'active', pageSize: 100 });
  const isMatch = form.type === 'MATCH' || form.type === 'FRIENDLY';
  const save = useSubmit(async () => {
    const match =
      isMatch && form.opponentName
        ? {
            opponentName: form.opponentName,
            isHome: form.isHome,
            ...(form.competitionName ? { competitionName: form.competitionName } : {}),
            ...(form.teamId ? { teamId: form.teamId } : {}),
            ...(form.teamScore !== '' ? { teamScore: Number(form.teamScore) } : {}),
            ...(form.opponentScore !== '' ? { opponentScore: Number(form.opponentScore) } : {})
          }
        : undefined;
    const body = {
      title: form.title,
      type: form.type,
      startsAt: new Date(form.startsAt).toISOString(),
      isPublic: form.isPublic,
      description: form.description,
      locationName: form.locationName,
      address: form.address,
      ...(match ? { match } : {})
    };

    if (editingId) {
      await api(`/events/${editingId}`, {
        method: 'PATCH',
        body: {
          ...body,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
          tryoutId: form.tryoutId
        }
      });
    } else {
      await api('/events', {
        method: 'POST',
        body: {
          ...body,
          ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
          ...(form.tryoutId ? { tryoutId: form.tryoutId } : {})
        }
      });
      setForm(EMPTY);
    }

    await onSaved();
  });
  const set = (key: keyof Form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <form className="form card" onSubmit={(event) => void save.submit(event)}>
      <ErrorSummary error={save.error} />
      <div className="form-grid">
        <TextField
          label="Título"
          maxLength={180}
          required
          value={form.title}
          onChange={set('title')}
        />
        <SelectField
          label="Tipo"
          value={form.type}
          onChange={set('type')}
          options={Object.entries(EVENT_TYPE).map(([value, label]) => ({ value, label }))}
        />
        <TextField
          label="Início"
          type="datetime-local"
          required
          value={form.startsAt}
          onChange={set('startsAt')}
        />
        <TextField
          label="Término"
          type="datetime-local"
          value={form.endsAt}
          onChange={set('endsAt')}
        />
        <TextField
          label="Local"
          maxLength={180}
          value={form.locationName}
          onChange={set('locationName')}
        />
        <TextField
          label="Endereço"
          maxLength={500}
          value={form.address}
          onChange={set('address')}
        />
        <SelectField
          label="Visibilidade"
          value={form.isPublic ? 'true' : 'false'}
          onChange={(e) => setForm({ ...form, isPublic: e.target.value === 'true' })}
          options={[
            { value: 'true', label: 'Público (site)' },
            { value: 'false', label: 'Interno' }
          ]}
        />
        <SelectField
          label="Seletiva vinculada"
          value={form.tryoutId}
          onChange={set('tryoutId')}
          options={[
            { value: '', label: 'Nenhuma' },
            ...(tryouts.data?.data ?? []).map((t) => ({ value: t.id, label: t.title }))
          ]}
        />
      </div>
      {isMatch ? (
        <fieldset className="form-grid">
          <legend>Partida</legend>
          <TextField
            label="Adversário"
            maxLength={160}
            required={form.type === 'MATCH'}
            value={form.opponentName}
            onChange={set('opponentName')}
          />
          <TextField
            label="Competição"
            maxLength={160}
            value={form.competitionName}
            onChange={set('competitionName')}
          />
          <SelectField
            label="Mando"
            value={form.isHome ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, isHome: e.target.value === 'true' })}
            options={[
              { value: 'true', label: 'Em casa' },
              { value: 'false', label: 'Fora' }
            ]}
          />
          <SelectField
            label="Equipe do Fênix"
            value={form.teamId}
            onChange={set('teamId')}
            options={[
              { value: '', label: 'Não informada' },
              ...teamOptions(teams.data ?? [], 'pick', initial.teamId)
            ]}
          />
          <TextField
            label="Sets do Fênix"
            type="number"
            min={0}
            max={99}
            value={form.teamScore}
            onChange={set('teamScore')}
          />
          <TextField
            label="Sets do adversário"
            type="number"
            min={0}
            max={99}
            value={form.opponentScore}
            onChange={set('opponentScore')}
          />
        </fieldset>
      ) : null}
      <TextArea
        label="Descrição"
        maxLength={8000}
        value={form.description}
        onChange={set('description')}
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          {editingId ? 'Salvar alterações' : 'Criar evento (rascunho)'}
        </button>
      </div>
    </form>
  );
}

export default function EventsAdminPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const list = useResource<Page<TeamEvent>>('/events', { page, pageSize: 25, status });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | null>(null);
  const [next, setNext] = useState<{ event: TeamEvent; status: EventStatus } | null>(null);

  return (
    <>
      <PageHeader
        title="Eventos e partidas"
        description="Eventos públicos confirmados aparecem em /eventos e na página inicial. Notícias podem se ligar a um evento."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setCreating((v) => !v);
            }}
          >
            {creating ? 'Fechar' : 'Novo evento'}
          </button>
        }
      />
      {creating ? <EventForm initial={EMPTY} editingId={null} onSaved={list.reload} /> : null}
      {editing ? (
        <>
          <h2>Editar: {editing.title}</h2>
          <EventForm
            key={editing.id}
            initial={fromEvent(editing)}
            editingId={editing.id}
            onSaved={async () => {
              setEditing(null);
              await list.reload();
            }}
          />
          <ImageUpload<TeamEvent>
            title="Capa do evento"
            endpoint={`/events/${editing.id}/cover`}
            currentUrl={editing.coverUrl}
            recommended="1600 × 900 px (16:9). Sem capa, o site usa a da notícia vinculada ou a logo"
            onUploaded={(updated) => {
              setEditing(updated);
              void list.reload();
            }}
          />
        </>
      ) : null}
      <div className="row">
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as EventStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(EVENT_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhum evento.</Empty> : null}
      {list.data && list.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Evento</th>
                  <th scope="col">Visibilidade</th>
                  <th scope="col">Situação</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((event) => (
                  <tr key={event.id}>
                    <td data-label="Quando">{formatDateTime(event.startsAt)}</td>
                    <td data-label="Evento">
                      <strong>{event.match ? scoreLabel(event.match) : event.title}</strong>
                      <br />
                      <small className="muted">
                        {EVENT_TYPE[event.type]}
                        {event.locationName ? ` · ${event.locationName}` : ''}
                      </small>
                    </td>
                    <td data-label="Visibilidade">{event.isPublic ? 'Público' : 'Interno'}</td>
                    <td data-label="Situação">
                      <span className={`badge ${EVENT_STATUS[event.status].badge}`}>
                        {EVENT_STATUS[event.status].label}
                      </span>
                    </td>
                    <td data-label="Ações">
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() => {
                            setCreating(false);
                            setEditing(event);
                          }}
                        >
                          Editar
                        </button>
                        {NEXT[event.status].map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            className="btn btn-link"
                            onClick={() => setNext({ event, status: action.status })}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
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
      <ConfirmDialog
        open={next !== null}
        title={next ? `${next.event.title}: ${EVENT_STATUS[next.status].label}` : ''}
        confirmLabel="Confirmar"
        danger={next?.status === 'CANCELLED'}
        requireReason={next?.status === 'CANCELLED'}
        onClose={() => setNext(null)}
        onConfirm={async (reason) => {
          await api(`/events/${next?.event.id ?? ''}/status`, {
            method: 'PUT',
            body: { status: next?.status, ...(reason ? { reason } : {}) }
          });
          await list.reload();
        }}
      />
    </>
  );
}
