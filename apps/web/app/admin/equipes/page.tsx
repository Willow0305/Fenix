'use client';

import { useState } from 'react';

import {
  Alert,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { type Category, TEAM_TYPE, type Team, type TeamType } from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';

export default function TeamsAdminPage() {
  const { can } = useAuth();
  const teams = useResource<Team[]>('/teams');
  const categories = useResource<Category[]>('/sport-categories');
  const [team, setTeam] = useState({
    name: '',
    type: 'FEMALE' as TeamType,
    categoryId: '',
    description: ''
  });
  const [category, setCategory] = useState({ name: '', minimumAge: '', maximumAge: '' });
  const manage = can('teams.manage');

  const createTeam = useSubmit(async () => {
    await api('/teams', {
      method: 'POST',
      body: {
        name: team.name,
        type: team.type,
        ...(team.categoryId ? { categoryId: team.categoryId } : {}),
        ...(team.description ? { description: team.description } : {})
      }
    });
    setTeam({ name: '', type: 'FEMALE', categoryId: '', description: '' });
    createTeam.setMessage('Equipe criada.');
    await teams.reload();
  });
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

  async function toggleTeam(t: Team) {
    await api(`/teams/${t.id}`, { method: 'PATCH', body: { isActive: !t.isActive } });
    await teams.reload();
  }

  async function toggleCategory(c: Category) {
    await api(`/sport-categories/${c.id}`, { method: 'PATCH', body: { isActive: !c.isActive } });
    await categories.reload();
  }

  return (
    <>
      <PageHeader
        title="Equipes e categorias"
        description="Equipe é o elenco; categoria é a classificação esportiva (faixa etária, nível)."
      />
      <section className="card stack" aria-labelledby="equipes">
        <h2 id="equipes">Equipes</h2>
        {teams.loading && !teams.data ? <Loading /> : null}
        {teams.error ? <Alert kind="error">{teams.error}</Alert> : null}
        {teams.data && teams.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Equipe</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Categoria</th>
                  <th scope="col" className="num">
                    Atletas ativos
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {teams.data.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{TEAM_TYPE[t.type]}</td>
                    <td>{t.category?.name ?? '—'}</td>
                    <td className="num">{t.activeAthletes ?? 0}</td>
                    <td>
                      <span className={`badge ${t.isActive ? 'badge-success' : ''}`}>
                        {t.isActive ? 'Ativa' : 'Inativa'}
                      </span>{' '}
                      {manage ? (
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() => void toggleTeam(t)}
                        >
                          {t.isActive ? 'Inativar' : 'Reativar'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : teams.data ? (
          <p className="muted">Nenhuma equipe cadastrada.</p>
        ) : null}
        {manage ? (
          <form className="form" onSubmit={(event) => void createTeam.submit(event)}>
            <h3>Nova equipe</h3>
            {createTeam.message ? <Alert kind="success">{createTeam.message}</Alert> : null}
            <ErrorSummary error={createTeam.error} />
            <div className="form-grid">
              <TextField
                label="Nome"
                maxLength={120}
                required
                value={team.name}
                onChange={(e) => setTeam({ ...team, name: e.target.value })}
              />
              <SelectField
                label="Tipo"
                value={team.type}
                onChange={(e) => setTeam({ ...team, type: e.target.value as TeamType })}
                options={Object.entries(TEAM_TYPE).map(([value, label]) => ({ value, label }))}
              />
              <SelectField
                label="Categoria"
                value={team.categoryId}
                onChange={(e) => setTeam({ ...team, categoryId: e.target.value })}
                options={[
                  { value: '', label: 'Sem categoria' },
                  ...(categories.data ?? [])
                    .filter((c) => c.isActive)
                    .map((c) => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>
            <TextArea
              label="Descrição pública"
              maxLength={4000}
              value={team.description}
              onChange={(e) => setTeam({ ...team, description: e.target.value })}
            />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={createTeam.pending}>
                Criar equipe
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="categorias">
        <h2 id="categorias">Categorias</h2>
        {categories.data && categories.data.length > 0 ? (
          <ul>
            {categories.data.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                {c.minimumAge !== null || c.maximumAge !== null
                  ? ` (${c.minimumAge ?? '…'}–${c.maximumAge ?? '…'} anos)`
                  : ''}{' '}
                {c.isActive ? null : <span className="badge">Inativa</span>}{' '}
                {manage ? (
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => void toggleCategory(c)}
                  >
                    {c.isActive ? 'Inativar' : 'Reativar'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nenhuma categoria cadastrada.</p>
        )}
        {manage ? (
          <form className="form" onSubmit={(event) => void createCategory.submit(event)}>
            <h3>Nova categoria</h3>
            {createCategory.message ? <Alert kind="success">{createCategory.message}</Alert> : null}
            <ErrorSummary error={createCategory.error} />
            <div className="form-grid">
              <TextField
                label="Nome"
                maxLength={120}
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
                Criar categoria
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </>
  );
}
