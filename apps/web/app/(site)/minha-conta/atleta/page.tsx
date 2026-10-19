'use client';

import { Alert, Loading, PageHeader } from '../../../../components/ui';
import { formatDate } from '../../../../lib/format';
import { ATHLETE_STATUS, type AthleteDetail, GENDER } from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

export default function MyAthletePage() {
  const athlete = useResource<AthleteDetail>('/me/athlete');

  if (athlete.loading && !athlete.data) {
    return <Loading />;
  }

  if (!athlete.data) {
    return <Alert kind="info">{athlete.error ?? 'Cadastro de atleta não encontrado.'}</Alert>;
  }

  const a = athlete.data;
  const rows: [string, string | null][] = [
    ['Nome', a.fullName],
    ['Apelido', a.preferredName],
    ['Nascimento', formatDate(a.birthDate)],
    ['Posição', a.position],
    ['Gênero', a.gender ? GENDER[a.gender] : null],
    ['E-mail', a.email],
    ['Telefone', a.phone],
    ['Documento', a.documentNumberMasked],
    [
      'Contato de emergência',
      [a.emergencyContactName, a.emergencyContactPhone].filter(Boolean).join(' · ') || null
    ],
    ['Responsável', [a.guardianName, a.guardianPhone].filter(Boolean).join(' · ') || null]
  ];

  return (
    <>
      <PageHeader
        title="Meus dados de atleta"
        description="Para corrigir algum dado, fale com a diretoria."
      />
      <div className="row">
        <span className={`badge ${ATHLETE_STATUS[a.status].badge}`}>
          {ATHLETE_STATUS[a.status].label}
        </span>
        {a.teams.map((team) => (
          <span key={team} className="badge badge-brand">
            {team}
          </span>
        ))}
      </div>
      <dl className="card" style={{ display: 'grid', gap: '0.6rem', margin: 0 }}>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="muted">{label}</dt>
              <dd style={{ margin: 0 }}>{value}</dd>
            </div>
          ))}
      </dl>
      <section className="card stack" aria-labelledby="historico">
        <h2 id="historico">Histórico de equipes</h2>
        {a.memberships.length === 0 ? (
          <p className="muted">Nenhum vínculo registrado.</p>
        ) : (
          <ul>
            {a.memberships.map((m) => (
              <li key={m.id}>
                {m.team.name}: desde {formatDate(m.startsOn)}
                {m.endsOn ? ` até ${formatDate(m.endsOn)}` : ' (atual)'}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
