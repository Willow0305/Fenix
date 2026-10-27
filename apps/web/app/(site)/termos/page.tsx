import type { Metadata } from 'next';

import { ConsumerRights } from '../../../components/consumer-rights';
import { getPublicTeam } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Termos de uso' };

export default async function TermsPage() {
  const team = await getPublicTeam();

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Termos de uso</h1>
      <div className="card prose">
        {team.termsOfUse ??
          'Os termos de uso estão em elaboração pela diretoria e serão publicados aqui.'}
      </div>
      <ConsumerRights />
    </div>
  );
}
