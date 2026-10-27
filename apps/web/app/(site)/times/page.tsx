import type { Metadata } from 'next';
import Link from 'next/link';

import { Avatar } from '../../../components/avatar';
import { BrandLogo } from '../../../components/brand-logo';
import { Icon } from '../../../components/icon';
import { JoinTeamCta } from '../../../components/join-team-cta';
import { firstTeamLogo } from '../../../lib/brand';
import { getPublicTeam, serverGet } from '../../../lib/server-api';
import {
  type RosterCategory,
  TEAM_TYPE,
  type TeamType,
  type Tryout
} from '../../../lib/sports-types';

export const metadata: Metadata = { title: 'Times' };

const FILTERS: { value: TeamType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Feminino' },
  { value: 'MIXED', label: 'Misto' }
];

/**
 * Times por categoria e elenco público (PEN-062, DT-044). Só aparece quem escolheu perfil
 * público na própria conta; menores, apenas com autorização do responsável. Nome de
 * exibição, posição e foto: nunca idade ou contato. O elenco começa fechado e abre ou
 * fecha ao clicar no cartão do time.
 */
export default async function TeamsPage({
  searchParams
}: {
  readonly searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const type = FILTERS.some((f) => f.value === tipo && f.value) ? (tipo as TeamType) : undefined;
  const [roster, club, tryouts] = await Promise.all([
    serverGet<RosterCategory[]>(`/public/teams-roster${type ? `?type=${type}` : ''}`).then(
      (rows) => rows ?? []
    ),
    getPublicTeam(),
    serverGet<Tryout[]>('/public/tryouts', 30).then((rows) => rows ?? [])
  ]);
  // Com filtro, conta só as seletivas desse tipo de time (ou sem time definido).
  const openTryouts = tryouts.filter(
    (tryout) => !type || !tryout.team || tryout.team.type === type
  ).length;
  const official = club.brandAssets.OFFICIAL;
  const teams = roster.flatMap((group) => group.teams);
  const headingLogo = (type ? firstTeamLogo(teams, type) : undefined) ?? official?.url;
  const teamCount = roster.reduce((total, group) => total + group.teams.length, 0);

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <div className="row">
        <BrandLogo src={headingLogo} alt="" size={64} />
        <h1 style={{ margin: 0 }}>
          {type === 'MALE'
            ? 'Time masculino'
            : type === 'FEMALE'
              ? 'Time feminino'
              : 'Nossos times'}
        </h1>
      </div>
      <nav aria-label="Filtrar por time" className="row">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/times?tipo=${filter.value}` : '/times'}
            className={`btn btn-sm ${(type ?? '') === filter.value ? 'btn-primary' : 'btn-secondary'}`}
            aria-current={(type ?? '') === filter.value ? 'page' : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <JoinTeamCta openTryouts={openTryouts} />

      {teamCount === 0 ? (
        <p className="card empty">
          {type
            ? 'Nenhuma equipe deste tipo por enquanto.'
            : 'As equipes serão apresentadas em breve.'}
        </p>
      ) : (
        roster.map((group) => (
          <section
            key={group.category?.id ?? 'sem-categoria'}
            className="stack"
            aria-labelledby={`cat-${group.category?.id ?? 'outras'}`}
          >
            <h2 id={`cat-${group.category?.id ?? 'outras'}`} style={{ margin: 0 }}>
              {group.category ? `Categoria ${group.category.name}` : 'Outras equipes'}
            </h2>
            {group.teams.map((team) => {
              return (
                <details key={team.id} className="card team-card" id={team.slug}>
                  <summary>
                    <span className="team-card-head">
                      <BrandLogo src={team.logoUrl ?? official?.url} alt="" size={40} />
                      <strong className="team-card-name">{team.name}</strong>
                      <span className="badge badge-brand">{TEAM_TYPE[team.type]}</span>
                      <span className="spacer" />
                      <span className="team-card-toggle">
                        <Icon name="people" /> Elenco ({team.athletes.length})
                        <Icon name="chevron-down" className="team-card-chevron" />
                      </span>
                    </span>
                    {team.description ? (
                      <span className="prose team-card-description">{team.description}</span>
                    ) : null}
                  </summary>
                  {team.athletes.length > 0 ? (
                    <ul className="roster" aria-label={`Elenco de ${team.name}`}>
                      {team.athletes.map((athlete) => (
                        <li key={`${athlete.displayName}-${athlete.position ?? ''}`}>
                          <Avatar src={athlete.photoUrl} name={athlete.displayName} size={72} />
                          <strong className="line-clamp-2">{athlete.displayName}</strong>
                          <span className="muted">{athlete.position ?? 'Posição a definir'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      O elenco aparece aqui quando os atletas escolherem perfil público.
                    </p>
                  )}
                </details>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
