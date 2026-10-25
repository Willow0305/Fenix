'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import { Icon } from '../../../components/icon';
import {
  Alert,
  ClearFilters,
  Empty,
  PageHeader,
  Pagination,
  Skeleton
} from '../../../components/ui';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDate } from '../../../lib/format';
import {
  ATHLETE_STATUS,
  type AthleteStatus,
  type AthleteSummary,
  type Team
} from '../../../lib/sports-types';
import { teamOptions } from '../../../lib/team-options';
import { useResource } from '../../../lib/use-resource';
import { useUrlFilters } from '../../../lib/use-url-filters';

const DEFAULTS = { busca: '', status: '', equipe: '' };

function AthletesList() {
  const { can } = useAuth();
  const filters = useUrlFilters(DEFAULTS);
  const { busca, status, equipe } = filters.values;
  // Texto digitado fica local até buscar; os demais filtros aplicam na hora.
  const [search, setSearch] = useState(busca);
  const teams = useResource<Team[]>('/teams');
  const athletes = useResource<Page<AthleteSummary>>('/athletes', {
    page: filters.page,
    pageSize: 25,
    status,
    teamId: equipe,
    search: busca
  });

  useEffect(() => setSearch(busca), [busca]);

  return (
    <>
      <PageHeader
        title="Atletas"
        description="Cadastro, status e vínculos com equipes."
        actions={
          can('athletes.create') ? (
            <Link href="/admin/atletas/novo" className="btn btn-primary">
              <Icon name="plus-lg" /> Novo atleta
            </Link>
          ) : null
        }
      />
      <form
        className="row filter-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          filters.set({ busca: search.trim() });
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou e-mail"
          />
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select
            value={status}
            onChange={(e) => filters.set({ status: e.target.value as AthleteStatus | '' })}
          >
            <option value="">Todos</option>
            {Object.entries(ATHLETE_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Equipe</span>
          <select value={equipe} onChange={(e) => filters.set({ equipe: e.target.value })}>
            <option value="">Todas</option>
            {teamOptions(teams.data ?? [], 'filter').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary">
            <Icon name="search" /> Buscar
          </button>
          <ClearFilters active={filters.active} onClear={filters.clear} />
        </div>
      </form>
      {athletes.error ? <Alert kind="error">{athletes.error}</Alert> : null}
      {athletes.loading && !athletes.data ? <Skeleton lines={5} /> : null}
      {athletes.data?.data.length === 0 ? (
        <Empty>
          {filters.active > 0 ? (
            <>
              Nenhum atleta para os filtros.{' '}
              <button type="button" className="btn btn-link" onClick={filters.clear}>
                Limpar filtros
              </button>
            </>
          ) : (
            'Nenhum atleta cadastrado ainda.'
          )}
        </Empty>
      ) : null}
      {athletes.data && athletes.data.data.length > 0 ? (
        <>
          <p className="muted" aria-live="polite" style={{ margin: 0 }}>
            {athletes.data.meta.total} atleta(s)
          </p>
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Nascimento</th>
                  <th scope="col">Posição</th>
                  <th scope="col">Equipes</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {athletes.data.data.map((athlete) => (
                  <tr key={athlete.id}>
                    <td data-label="Nome">
                      <Link href={`/admin/atletas/${athlete.id}`}>{athlete.fullName}</Link>
                      {athlete.hasAccount ? (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          <Icon name="person-check" /> com conta
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Nascimento">{formatDate(athlete.birthDate)}</td>
                    <td data-label="Posição">{athlete.position ?? '—'}</td>
                    <td data-label="Equipes">{athlete.teams.join(', ') || '—'}</td>
                    <td data-label="Status">
                      <span className={`badge ${ATHLETE_STATUS[athlete.status].badge}`}>
                        {ATHLETE_STATUS[athlete.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {athletes.data ? <Pagination {...athletes.data.meta} onChange={filters.setPage} /> : null}
    </>
  );
}

export default function AthletesPage() {
  return (
    <Suspense fallback={<Skeleton lines={5} />}>
      <AthletesList />
    </Suspense>
  );
}
