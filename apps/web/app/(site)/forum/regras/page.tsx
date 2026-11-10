import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '../../../../components/icon';
import type { ForumRules } from '../../../../lib/content-types';
import { serverGet } from '../../../../lib/server-api';

export const metadata: Metadata = { title: 'Regras do fórum' };

/** Regras do fórum (DT-108): texto da diretoria, ou o texto inicial do sistema. */
export default async function ForumRulesPage() {
  const rules = await serverGet<ForumRules>('/forum/rules', 60);

  return (
    <div className="container stack pt-xl" style={{ maxWidth: 860 }}>
      <p className="m-0">
        <Link href="/forum" className="back-link">
          <Icon name="chevron-left" /> Fórum
        </Link>
      </p>
      <h1 className="m-0">Regras do fórum</h1>
      <div className="card prose pre-line">
        {rules?.text ?? 'Não foi possível carregar as regras agora. Tente de novo em instantes.'}
      </div>
    </div>
  );
}
