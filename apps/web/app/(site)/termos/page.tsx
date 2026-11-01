import type { Metadata } from 'next';

import { ConsumerRights } from '../../../components/consumer-rights';
import { LegalVersionNote } from '../../../components/legal-version';
import { getPublicTeam } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Termos de uso' };

export default async function TermsPage() {
  const team = await getPublicTeam();

  return (
    <div className="container stack pt-xl">
      <h1>Termos de uso</h1>
      {team.termsOfUse ? <LegalVersionNote version={team.legalVersions?.termsOfUse} /> : null}
      <div className="card prose">
        {team.termsOfUse ??
          'Os termos de uso estão em elaboração pela diretoria e serão publicados aqui.'}
      </div>
      <ConsumerRights />
    </div>
  );
}
