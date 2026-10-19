import type { Metadata } from 'next';
import Link from 'next/link';

import { serverGet } from '../../../lib/server-api';
import { TEAM_TYPE, type Team, type TeamType } from '../../../lib/sports-types';

export const metadata: Metadata = { title: 'Times' };

const FILTERS: { value: TeamType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Feminino' },
  { value: 'MIXED', label: 'Misto' }
];

export default async function TeamsPage({
  searchParams
}: {
  readonly searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const teams = (await serverGet<Team[]>('/public/teams')) ?? [];
  const filtered = tipo ? teams.filter((team) => team.type === tipo) : teams;

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Nossos times</h1>
      <nav aria-label="Filtrar por time" className="row">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/times?tipo=${filter.value}` : '/times'}
            className={`btn btn-sm ${(tipo ?? '') === filter.value ? 'btn-primary' : 'btn-secondary'}`}
            aria-current={(tipo ?? '') === filter.value ? 'page' : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      {filtered.length === 0 ? (
        <p className="empty">
          {teams.length === 0
            ? 'As equipes serão apresentadas em breve.'
            : 'Nenhuma equipe nesta categoria por enquanto.'}
        </p>
      ) : (
        <div className="stat-grid">
          {filtered.map((team) => (
            <article key={team.id} className="card stack">
              <div className="row">
                <h2 style={{ margin: 0 }}>{team.name}</h2>
                <span className="badge badge-brand">{TEAM_TYPE[team.type]}</span>
              </div>
              {team.category ? (
                <span className="muted">Categoria: {team.category.name}</span>
              ) : null}
              {team.description ? <p className="prose">{team.description}</p> : null}
            </article>
          ))}
        </div>
      )}
      <p>
        Quer jogar com a gente? <Link href="/seletivas">Veja as seletivas</Link> ou{' '}
        <Link href="/interesse">deixe seu contato</Link>.
      </p>
    </div>
  );
}
