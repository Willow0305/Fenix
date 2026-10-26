import type { Metadata } from 'next';

import { BrandLogo } from '../../../components/brand-logo';
import { getPublicTeam } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Sobre' };

export default async function AboutPage() {
  const team = await getPublicTeam();
  const logo = team.brandAssets.OFFICIAL;
  const cover = team.brandAssets.COVER;

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      {cover ? (
        <img className="about-cover" src={cover.url} alt={cover.altText ?? ''} loading="eager" />
      ) : null}
      <div className="row">
        <BrandLogo src={logo?.url} alt={logo?.altText ?? undefined} size={96} />
        <div>
          <h1>{team.officialName}</h1>
          {team.description ? <p className="muted">{team.description}</p> : null}
        </div>
      </div>
      <section className="card" aria-labelledby="historia">
        <h2 id="historia">Nossa história</h2>
        <p className="prose">
          {team.history ?? 'A história do time será publicada em breve pela diretoria.'}
        </p>
      </section>
    </div>
  );
}
