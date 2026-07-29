'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import { CollectionState, Feedback, SportsPageHeader, StatusBadge } from '../_components/sports-ui';
import {
  type CategoryRecord,
  createSportsRecord,
  formatInstant,
  getRequestErrorMessage,
  listSportsRecords,
  type TeamRecord,
  translateStatus,
  type TryoutRecord
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

export default function TryoutsPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('tryouts.manage');
  const [tryouts, setTryouts] = useState<readonly TryoutRecord[]>([]);
  const [teams, setTeams] = useState<readonly TeamRecord[]>([]);
  const [categories, setCategories] = useState<readonly CategoryRecord[]>([]);
  const [title, setTitle] = useState('');
  const [teamId, setTeamId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [registrationStartsAt, setRegistrationStartsAt] = useState('');
  const [registrationEndsAt, setRegistrationEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [waitlistCapacity, setWaitlistCapacity] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [tryoutResponse, teamResponse, categoryResponse] = await Promise.all([
        listSportsRecords<TryoutRecord>('/tryouts'),
        listSportsRecords<TeamRecord>('/teams'),
        listSportsRecords<CategoryRecord>('/categories')
      ]);
      setTryouts(tryoutResponse.data);
      setTeams(teamResponse.data.filter((team) => team.isActive));
      setCategories(categoryResponse.data.filter((category) => category.isActive));
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível carregar as seletivas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTryout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await createSportsRecord<TryoutRecord>('/tryouts', {
        title: title.trim(),
        teamId,
        categoryId,
        startsAt: new Date(startsAt).toISOString(),
        registrationStartsAt: new Date(registrationStartsAt).toISOString(),
        registrationEndsAt: new Date(registrationEndsAt).toISOString(),
        location: location.trim() || null,
        capacity: Number(capacity),
        waitlistCapacity: waitlistCapacity ? Number(waitlistCapacity) : null
      });
      setTitle('');
      setTeamId('');
      setCategoryId('');
      setStartsAt('');
      setRegistrationStartsAt('');
      setRegistrationEndsAt('');
      setLocation('');
      setCapacity('');
      setWaitlistCapacity('');
      setNotice('Seletiva criada em estado inicial controlado.');
      await load();
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível criar a seletiva.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SportsPageHeader
        description="Organize vagas e acompanhe inscrições, lista de espera, presença e resultado por transições auditadas."
        eyebrow="Processo seletivo"
        title="Seletivas"
      />

      {canManage ? (
        <section className={styles.panel} aria-labelledby="create-tryout-title">
          <div className={styles.panelHeader}>
            <h2 id="create-tryout-title">Nova seletiva</h2>
          </div>
          <form className={styles.formGrid} onSubmit={createTryout}>
            <label className={styles.field}>
              Título
              <input
                maxLength={160}
                minLength={3}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className={styles.field}>
              Equipe
              <select onChange={(event) => setTeamId(event.target.value)} required value={teamId}>
                <option value="">Selecione</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Categoria
              <select
                onChange={(event) => setCategoryId(event.target.value)}
                required
                value={categoryId}
              >
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Data e horário
              <input
                onChange={(event) => setStartsAt(event.target.value)}
                required
                type="datetime-local"
                value={startsAt}
              />
            </label>
            <label className={styles.field}>
              Início das inscrições
              <input
                onChange={(event) => setRegistrationStartsAt(event.target.value)}
                required
                type="datetime-local"
                value={registrationStartsAt}
              />
            </label>
            <label className={styles.field}>
              Fim das inscrições
              <input
                onChange={(event) => setRegistrationEndsAt(event.target.value)}
                required
                type="datetime-local"
                value={registrationEndsAt}
              />
            </label>
            <label className={styles.field}>
              Local
              <input
                maxLength={220}
                onChange={(event) => setLocation(event.target.value)}
                value={location}
              />
            </label>
            <label className={styles.field}>
              Número de vagas
              <input
                min={1}
                onChange={(event) => setCapacity(event.target.value)}
                required
                type="number"
                value={capacity}
              />
            </label>
            <label className={styles.field}>
              Vagas na espera
              <input
                min={0}
                onChange={(event) => setWaitlistCapacity(event.target.value)}
                type="number"
                value={waitlistCapacity}
              />
            </label>
            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? 'Criando…' : 'Criar seletiva'}
            </button>
          </form>
        </section>
      ) : null}

      <Feedback error={error} notice={notice} />

      <section className={styles.panel} aria-labelledby="tryout-list-title">
        <div className={styles.panelHeader}>
          <h2 id="tryout-list-title">Seletivas cadastradas</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <CollectionState
          emptyMessage="Nenhuma seletiva fictícia foi criada neste ambiente."
          isEmpty={tryouts.length === 0}
          loading={loading}
        >
          <div className={styles.recordGrid}>
            {tryouts.map((tryout) => (
              <article className={styles.recordCard} key={tryout.id}>
                <div className={styles.cardHeader}>
                  <h3>{tryout.title}</h3>
                  <StatusBadge value={translateStatus(tryout.status)} />
                </div>
                <dl className={styles.metaList}>
                  <dt>Equipe</dt>
                  <dd>{tryout.team?.name ?? 'Não informada'}</dd>
                  <dt>Categoria</dt>
                  <dd>{tryout.category?.name ?? 'Não informada'}</dd>
                  <dt>Início</dt>
                  <dd>{formatInstant(tryout.startsAt)}</dd>
                  <dt>Local</dt>
                  <dd>{tryout.location ?? 'Não informado'}</dd>
                  <dt>Ocupação</dt>
                  <dd>
                    {tryout.registrationsCount}
                    {tryout.capacity === null ? '' : ` de ${tryout.capacity}`} inscrição(ões)
                  </dd>
                  <dt>Lista de espera</dt>
                  <dd>{tryout.waitlistCount}</dd>
                </dl>
              </article>
            ))}
          </div>
        </CollectionState>
      </section>
    </>
  );
}
