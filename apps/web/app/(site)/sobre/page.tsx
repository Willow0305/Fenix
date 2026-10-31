import type { Metadata } from 'next';

import { BrandLogo } from '../../../components/brand-logo';
import { PhotoCarousel } from '../../../components/photo-carousel';
import { getPublicTeam } from '../../../lib/server-api';
import { responsiveSrcSet } from '../../../lib/image-url';

export const metadata: Metadata = { title: 'Sobre' };

export default async function AboutPage() {
  const team = await getPublicTeam();
  const logo = team.brandAssets.OFFICIAL;
  const cover = team.brandAssets.COVER;
  const photos = team.photos ?? [];

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      {photos.length > 0 ? (
        <PhotoCarousel photos={photos} />
      ) : cover ? (
        <img
          className="about-cover"
          src={cover.url}
          srcSet={responsiveSrcSet(cover.url)}
          sizes="(min-width: 64rem) 60rem, 100vw"
          alt={cover.altText ?? ''}
          loading="eager"
        />
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
