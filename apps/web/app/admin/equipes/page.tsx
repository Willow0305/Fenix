'use client';

import { FIELD_LIMITS } from '@fenix/validation';
import { useState } from 'react';

import { Icon } from '../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  PageHeader,
  SelectField,
  Skeleton,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { type Category, TEAM_TYPE, type Team, type TeamType } from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';
import { CategoryManager } from '../../../components/category-manager';

interface TeamFormState {
  name: string;
  type: TeamType;
  categoryId: string;
  description: string;
}

const EMPTY_TEAM: TeamFormState = { name: '', type: 'FEMALE', categoryId: '', description: '' };

/** Formulário único de equipe, para criar e editar (docs/29 COR-017). */
function TeamForm({
  initial,
  categories,
  submitLabel,
  onSubmit,
  onCancel
}: {
  readonly initial: TeamFormState;
  readonly categories: readonly Category[];
  readonly submitLabel: string;
  readonly onSubmit: (form: TeamFormState) => Promise<void>;
  readonly onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const save = useSubmit(async () => {
    await onSubmit(form);
  });

  return (
    <form className="form" onSubmit={(event) => void save.submit(event)}>
      <ErrorSummary error={save.error} />
      <div className="form-grid">
        <TextField
          label="Nome"
          maxLength={FIELD_LIMITS.shortName}
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={save.fieldError('name')}
        />
        <SelectField
          label="Tipo"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as TeamType })}
          options={Object.entries(TEAM_TYPE).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Categoria"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          options={[
            { value: '', label: 'Sem categoria' },
            ...categories
              .filter((c) => c.isActive || c.id === initial.categoryId)
              .map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (inativa)` }))
          ]}
        />
      </div>
      <TextArea
        label="Descrição pública"
        maxLength={4000}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        hint="Aparece na página Times do site."
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          <Icon name="check-lg" /> {save.pending ? 'Salvando…' : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default function TeamsAdminPage() {
  const { can } = useAuth();
  const teams = useResource<Team[]>('/teams');
  const categories = useResource<Category[]>('/sport-categories');
  const [category, setCategory] = useState({ name: '', minimumAge: '', maximumAge: '' });
  const [editing, setEditing] = useState<Team | null>(null);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<Team | null>(null);
  const [togglingCategory, setTogglingCategory] = useState<Category | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const manage = can('teams.manage');

  async function saveTeam(form: TeamFormState, id?: string) {
    await api(id ? `/teams/${id}` : '/teams', {
      method: id ? 'PATCH' : 'POST',
      body: {
        name: form.name,
        type: form.type,
        // Na edição, vazio remove categoria e descrição.
        ...(form.categoryId || id ? { categoryId: form.categoryId || null } : {}),
        ...(form.description || id ? { description: form.description || null } : {})
      }
    });
    setNotice(id ? 'Equipe atualizada.' : 'Equipe criada.');
    setEditing(null);
    setCreating(false);
    await teams.reload();
  }

  const createCategory = useSubmit(async () => {
    await api('/sport-categories', {
      method: 'POST',
      body: {
        name: category.name,
        ...(category.minimumAge ? { minimumAge: Number(category.minimumAge) } : {}),
        ...(category.maximumAge ? { maximumAge: Number(category.maximumAge) } : {})
      }
    });
    setCategory({ name: '', minimumAge: '', maximumAge: '' });
    createCategory.setMessage('Categoria criada.');
    await categories.reload();
  });

  return (
    <>
      <PageHeader
        title="Equipes e categorias"
        description="Equipe é o elenco; categoria é a classificação esportiva (faixa etária, nível)."
        actions={
          manage && !creating ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus-lg" /> Nova equipe
            </button>
          ) : null
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {creating ? (
        <section className="card stack" aria-labelledby="nova-equipe">
          <h2 id="nova-equipe">Nova equipe</h2>
          <TeamForm
            initial={EMPTY_TEAM}
            categories={categories.data ?? []}
            submitLabel="Criar equipe"
            onSubmit={(form) => saveTeam(form)}
            onCancel={() => setCreating(false)}
          />
        </section>
      ) : null}

      {editing ? (
        <section className="card stack" aria-labelledby="editar-equipe">
          <h2 id="editar-equipe">Editar: {editing.name}</h2>
          <TeamForm
            key={editing.id}
            initial={{
              name: editing.name,
              type: editing.type,
              categoryId: editing.category?.id ?? '',
              description: editing.description ?? ''
            }}
            categories={categories.data ?? []}
            submitLabel="Salvar alterações"
            onSubmit={(form) => saveTeam(form, editing.id)}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="equipes">
        <h2 id="equipes">Equipes</h2>
        {teams.loading && !teams.data ? <Skeleton lines={4} /> : null}
        {teams.error ? <Alert kind="error">{teams.error}</Alert> : null}
        {teams.data && teams.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Equipe</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Categoria</th>
                  <th scope="col" className="num">
                    Vínculos atuais
                  </th>
                  <th scope="col">Situação</th>
                  {manage ? <th scope="col">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {teams.data.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Equipe">{t.name}</td>
                    <td data-label="Tipo">{TEAM_TYPE[t.type]}</td>
                    <td data-label="Categoria">{t.category?.name ?? '—'}</td>
                    <td data-label="Vínculos atuais" className="num">
                      {t.activeAthletes ?? 0}
                    </td>
                    <td data-label="Situação">
                      <span className={`badge ${t.isActive ? 'badge-success' : ''}`}>
                        {t.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    {manage ? (
                      <td data-label="Ações">
                        <div className="row" style={{ gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setCreating(false);
                              setEditing(t);
                            }}
                          >
                            <Icon name="pencil" /> Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setToggling(t)}
                          >
                            {t.isActive ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : teams.data ? (
          <p className="muted">Nenhuma equipe cadastrada.</p>
        ) : null}
        <p className="muted" style={{ margin: 0 }}>
          “Vínculos atuais” conta atletas com vínculo aberto na equipe, qualquer que seja o status
          do atleta.
        </p>
      </section>

      <section className="card stack" aria-labelledby="categorias">
        <h2 id="categorias">Categorias</h2>
        <p className="muted" style={{ margin: 0 }}>
          A faixa etária é informativa: ao vincular um atleta fora dela, o painel avisa, mas não
          impede.
        </p>
        <CategoryManager
          items={(categories.data ?? []).map((c) => ({
            ...c,
            detail:
              c.minimumAge !== null || c.maximumAge !== null
                ? `${c.minimumAge ?? '…'}–${c.maximumAge ?? '…'} anos`
                : undefined
          }))}
          endpoint="/sport-categories"
          manage={manage}
          onChanged={categories.reload}
        />
        {manage ? (
          <form className="form" onSubmit={(event) => void createCategory.submit(event)}>
            <h3>Nova categoria</h3>
            {createCategory.message ? <Alert kind="success">{createCategory.message}</Alert> : null}
            <ErrorSummary error={createCategory.error} />
            <div className="form-grid">
              <TextField
                label="Nome"
                maxLength={FIELD_LIMITS.shortName}
                required
                value={category.name}
                onChange={(e) => setCategory({ ...category, name: e.target.value })}
              />
              <TextField
                label="Idade mínima"
                type="number"
                min={0}
                value={category.minimumAge}
                onChange={(e) => setCategory({ ...category, minimumAge: e.target.value })}
              />
              <TextField
                label="Idade máxima"
                type="number"
                min={0}
                value={category.maximumAge}
                onChange={(e) => setCategory({ ...category, maximumAge: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={createCategory.pending}>
                <Icon name="plus-lg" /> Criar categoria
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <ConfirmDialog
        open={toggling !== null}
        title={
          toggling?.isActive ? `Inativar ${toggling.name}` : `Reativar ${toggling?.name ?? ''}`
        }
        description={
          toggling?.isActive
            ? `A equipe some do site e não recebe novos atletas, partidas, seletivas nem comunicados. Os ${toggling.activeAthletes ?? 0} vínculo(s) atuais continuam; encerre-os na ficha de cada atleta, se for o caso.`
            : 'A equipe volta a aparecer no site e a aceitar novos vínculos.'
        }
        confirmLabel={toggling?.isActive ? 'Inativar' : 'Reativar'}
        danger={toggling?.isActive ?? false}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) {
            return;
          }

          await api(`/teams/${toggling.id}`, {
            method: 'PATCH',
            body: { isActive: !toggling.isActive }
          });
          setNotice(toggling.isActive ? 'Equipe inativada.' : 'Equipe reativada.');
          await teams.reload();
        }}
      />
      <ConfirmDialog
        open={togglingCategory !== null}
        title={
          togglingCategory?.isActive
            ? `Inativar categoria ${togglingCategory.name}`
            : `Reativar categoria ${togglingCategory?.name ?? ''}`
        }
        description={
          togglingCategory?.isActive
            ? 'A categoria deixa de aparecer ao criar equipes. Equipes que já a usam continuam com ela.'
            : undefined
        }
        confirmLabel={togglingCategory?.isActive ? 'Inativar' : 'Reativar'}
        onClose={() => setTogglingCategory(null)}
        onConfirm={async () => {
          if (!togglingCategory) {
            return;
          }

          await api(`/sport-categories/${togglingCategory.id}`, {
            method: 'PATCH',
            body: { isActive: !togglingCategory.isActive }
          });
          await categories.reload();
        }}
      />
    </>
  );
}
