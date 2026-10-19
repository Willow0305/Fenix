'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Alert, Empty, Loading, PageHeader, Pagination } from '../../../components/ui';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDate } from '../../../lib/format';
import {
  ATHLETE_STATUS,
  type AthleteStatus,
  type AthleteSummary,
  type Team
} from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';

function AthletesList() {
  const { can } = useAuth();
  const params = useSearchParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AthleteStatus | ''>(
    (params.get('status') as AthleteStatus | null) ?? ''
  );
  const [teamId, setTeamId] = useState('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const teams = useResource<Team[]>('/teams');
  const athletes = useResource<Page<AthleteSummary>>('/athletes', {
    page,
    pageSize: 25,
    status,
    teamId,
    search: term
  });

  return (
    <>
      <PageHeader
        title="Atletas"
        description="Cadastro, status e vínculos com equipes."
        actions={
          can('athletes.create') ? (
            <Link href="/admin/atletas/novo" className="btn btn-primary">
              Novo atleta
            </Link>
          ) : null
        }
      />
      <form
        className="row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setTerm(search);
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou e-mail"
          />
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as AthleteStatus | '');
            }}
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
          <select
            value={teamId}
            onChange={(e) => {
              setPage(1);
              setTeamId(e.target.value);
            }}
          >
            <option value="">Todas</option>
            {(teams.data ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>
      {athletes.error ? <Alert kind="error">{athletes.error}</Alert> : null}
      {athletes.loading && !athletes.data ? <Loading /> : null}
      {athletes.data?.data.length === 0 ? (
        <Empty>
          {term || status || teamId
            ? 'Nenhum atleta para os filtros.'
            : 'Nenhum atleta cadastrado ainda.'}
        </Empty>
      ) : null}
      {athletes.data && athletes.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
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
                  <td>
                    <Link href={`/admin/atletas/${athlete.id}`}>{athlete.fullName}</Link>
                    {athlete.hasAccount ? (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        com conta
                      </span>
                    ) : null}
                  </td>
                  <td>{formatDate(athlete.birthDate)}</td>
                  <td>{athlete.position ?? '—'}</td>
                  <td>{athlete.teams.join(', ') || '—'}</td>
                  <td>
                    <span className={`badge ${ATHLETE_STATUS[athlete.status].badge}`}>
                      {ATHLETE_STATUS[athlete.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {athletes.data ? <Pagination {...athletes.data.meta} onChange={setPage} /> : null}
    </>
  );
}

export default function AthletesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AthletesList />
    </Suspense>
  );
}
