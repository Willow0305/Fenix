import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import { WhatsAppButton } from '../../components/whatsapp-button';
import { getPublicTeam } from '../../lib/server-api';

/** Imagem ao compartilhar links do site: capa ou brasão enviados no painel (R-12). */
export async function generateMetadata(): Promise<Metadata> {
  const { brandAssets } = await getPublicTeam();
  const image = brandAssets.COVER ?? brandAssets.OFFICIAL;

  return image
    ? {
        openGraph: {
          type: 'website',
          locale: 'pt_BR',
          siteName: 'Fênix Vôlei',
          images: [{ url: image.url, alt: image.altText ?? 'Fênix Vôlei' }]
        }
      }
    : {};
}

export default async function SiteLayout({ children }: { readonly children: ReactNode }) {
  const team = await getPublicTeam();
  const logo = team.brandAssets.OFFICIAL;

  return (
    <>
      <SiteHeader
        teamName={team.teamName}
        logoUrl={logo?.url}
        logoAlt={logo?.altText ?? undefined}
      />
      <main id="conteudo">{children}</main>
      <SiteFooter team={team} />
      <WhatsAppButton phone={team.phone} teamName={team.teamName} />
    </>
  );
}
