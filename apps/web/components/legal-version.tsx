import type { LegalVersion } from '../lib/api-types';
import { TEAM_TIME_ZONE } from '../lib/format';

/** "Versão 2, em vigor desde 01/11/2026": o texto exato que a pessoa aceita (DT-089). */
export function LegalVersionNote({ version }: { version: LegalVersion | null | undefined }) {
  if (!version) {
    return null;
  }

  const since = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: TEAM_TIME_ZONE
  }).format(new Date(version.publishedAt));

  return (
    <p className="muted m-0">
      Versão {version.version}, em vigor desde {since}.
    </p>
  );
}
