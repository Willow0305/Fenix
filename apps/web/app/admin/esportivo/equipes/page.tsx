'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import { CollectionState, Feedback, SportsPageHeader, StatusBadge } from '../_components/sports-ui';
import {
  type CategoryRecord,
  createSportsRecord,
  getRequestErrorMessage,
  listSportsRecords,
  type TeamRecord
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

export default function TeamsPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('teams.manage');
  const canAssignCategories = session.permissions.includes('teams.assign');
  const [teams, setTeams] = useState<readonly TeamRecord[]>([]);
  const [categories, setCategories] = useState<readonly CategoryRecord[]>([]);
  const [name, setName] = useState('');
  const [categoryIds, setCategoryIds] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [teamResponse, categoryResponse] = await Promise.all([
        listSportsRecords<TeamRecord>('/teams'),
        listSportsRecords<CategoryRecord>('/categories')
      ]);
      setTeams(teamResponse.data);
      setCategories(categoryResponse.data.filter((category) => category.isActive));
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível carregar as equipes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await createSportsRecord<TeamRecord>('/teams', {
        name: name.trim(),
        categoryIds: canAssignCategories ? categoryIds : []
      });
      setName('');
      setCategoryIds([]);
      setNotice('Equipe e vínculos de categoria criados com histórico preservável.');
      await load();
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível criar a equipe.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SportsPageHeader
        description="Equipes são independentes das categorias; cada vínculo é tratado explicitamente para permitir evolução com histórico."
        eyebrow="Estrutura esportiva"
        title="Equipes"
      />

      {canManage ? (
        <section className={styles.panel} aria-labelledby="create-team-title">
          <div className={styles.panelHeader}>
            <h2 id="create-team-title">Nova equipe</h2>
          </div>
          <form className={styles.formGrid} onSubmit={createTeam}>
            <label className={styles.field}>
              Nome
              <input
                maxLength={120}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            {canAssignCategories ? (
              <label className={styles.field}>
                Categorias iniciais
                <select
                  aria-describedby="team-category-help"
                  multiple
                  onChange={(event) =>
                    setCategoryIds(
                      [...event.currentTarget.selectedOptions].map((option) => option.value)
                    )
                  }
                  required
                  value={[...categoryIds]}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <small id="team-category-help">
                  Use Ctrl ou Command para selecionar mais de uma categoria.
                </small>
              </label>
            ) : (
              <p className={styles.privacyNote}>
                Sua sessão pode criar equipes, mas a atribuição de categorias exige permissão
                específica.
              </p>
            )}
            <button
              className={styles.button}
              disabled={submitting || (canAssignCategories && categories.length === 0)}
              type="submit"
            >
              {submitting ? 'Criando…' : 'Criar equipe'}
            </button>
          </form>
          {canAssignCategories && categories.length === 0 ? (
            <p className={styles.privacyNote}>
              Cadastre ao menos uma categoria ativa antes de criar a equipe.
            </p>
          ) : null}
        </section>
      ) : null}

      <Feedback error={error} notice={notice} />

      <section className={styles.panel} aria-labelledby="team-list-title">
        <div className={styles.panelHeader}>
          <h2 id="team-list-title">Equipes cadastradas</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <CollectionState
          emptyMessage="Nenhuma equipe fictícia foi cadastrada neste ambiente."
          isEmpty={teams.length === 0}
          loading={loading}
        >
          <div className={styles.recordGrid}>
            {teams.map((team) => (
              <article className={styles.recordCard} key={team.id}>
                <div className={styles.cardHeader}>
                  <h3>{team.name}</h3>
                  <StatusBadge value={team.isActive ? 'Ativa' : 'Inativa'} />
                </div>
                <dl className={styles.metaList}>
                  <dt>Categorias</dt>
                  <dd>
                    {team.categories.length > 0
                      ? team.categories.map((category) => category.name).join(', ')
                      : 'Sem vínculo vigente'}
                  </dd>
                  <dt>Atletas ativos</dt>
                  <dd>{team.athletesCount ?? 'Não informado'}</dd>
                </dl>
              </article>
            ))}
          </div>
        </CollectionState>
      </section>
    </>
  );
}
