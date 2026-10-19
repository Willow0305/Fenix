import type { ReactNode } from 'react';

import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import { getPublicTeam } from '../../lib/server-api';

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
    </>
  );
}
