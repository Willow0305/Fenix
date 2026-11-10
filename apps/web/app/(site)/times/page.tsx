import type { Metadata } from 'next';
import Link from 'next/link';

import { Avatar } from '../../../components/avatar';
import { BrandLogo } from '../../../components/brand-logo';
import { Icon } from '../../../components/icon';
import { JoinTeamCta, showJoinInvite } from '../../../components/join-team-cta';
import { firstTeamLogo, SYMBOL_SRC } from '../../../lib/brand';
import { fixedSrcSet, responsiveSrcSet } from '../../../lib/image-url';
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
  // Só conta seletiva que aceita inscrição agora (status, período e vagas, decididos pela API).
  // Com filtro, só as desse tipo de time (ou sem time definido).
  const openTryouts = tryouts.filter(
    (tryout) =>
      tryout.acceptingRegistrations && (!type || !tryout.team || tryout.team.type === type)
  ).length;
  const official = club.brandAssets.OFFICIAL;
  const teams = roster.flatMap((group) => group.teams);
  // A primeira foto já aparece na primeira tela: carrega sem esperar a rolagem.
  const firstPhotoTeamId = teams.find((team) => team.photoUrl)?.id;
  const headingLogo = (type ? firstTeamLogo(teams, type) : undefined) ?? official?.url;
  const teamCount = roster.reduce((total, group) => total + group.teams.length, 0);

  return (
    <div className="container stack pt-xl">
      <div className="row">
        <BrandLogo src={headingLogo} alt="" size={64} />
        <h1 className="m-0">
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

      {/* Desligado pela diretoria, só volta a aparecer com seletiva aberta (DT-091). */}
      {showJoinInvite(club.joinInviteEnabled, openTryouts, club.interestIntakeOpen) ? (
        <JoinTeamCta openTryouts={openTryouts} intakeOpen={club.interestIntakeOpen} />
      ) : null}

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
            <h2
              id={`cat-${group.category?.id ?? 'outras'}`}
              className={!group.category && roster.length === 1 ? 'visually-hidden' : 'm-0'}
            >
              {group.category
                ? `Categoria ${group.category.name}`
                : roster.length === 1
                  ? 'Equipes'
                  : 'Outras equipes'}
            </h2>
            {group.teams.map((team) => {
              return (
                <details key={team.id} className="card team-card" id={team.slug}>
                  <summary>
                    {team.photoUrl ? (
                      <img
                        className="team-card-photo"
                        src={team.photoUrl}
                        srcSet={responsiveSrcSet(team.photoUrl)}
                        sizes="(min-width: 56rem) 32rem, 100vw"
                        alt={`Foto de ${team.name}`}
                        loading={team.id === firstPhotoTeamId ? 'eager' : 'lazy'}
                      />
                    ) : null}
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
                          {athlete.photoUrl ? (
                            <Avatar src={athlete.photoUrl} name={athlete.displayName} size={72} />
                          ) : (
                            // Sem perfil público: a logo do Fênix no lugar da foto (DT-084).
                            <span className="avatar roster-logo" style={{ width: 72, height: 72 }}>
                              <img src={SYMBOL_SRC} srcSet={fixedSrcSet(SYMBOL_SRC, 48)} alt="" />
                            </span>
                          )}
                          <strong className="roster-name">{athlete.displayName}</strong>
                          <span className="muted">{athlete.position ?? 'Posição a definir'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
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
