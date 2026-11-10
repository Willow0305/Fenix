import Link from 'next/link';

import { Icon } from './icon';

/**
 * A diretoria pode desligar o convite (DT-091), mas com seletiva aberta ele aparece mesmo
 * assim, para levar às inscrições. Sem a configuração (dados antigos), fica ligado. Com os
 * contatos fechados (elenco lotado, DT-107), só aparece se houver seletiva aberta.
 */
export function showJoinInvite(
  enabled: boolean | undefined,
  openTryouts: number,
  intakeOpen: boolean | undefined = true
): boolean {
  if (openTryouts > 0) {
    return true;
  }

  return enabled !== false && intakeOpen !== false;
}

/**
 * Destino do botão "Quero jogar no Fênix" do Início (PEN-074): com seletiva aberta, as
 * inscrições em Eventos; sem nenhuma, o convite da página Times; com o convite desligado
 * pela diretoria, direto o formulário de contato. Com os contatos fechados e nenhuma
 * seletiva aberta, não há para onde levar: o botão some (`null`, DT-107).
 */
export function joinTeamHref(
  enabled: boolean | undefined,
  openTryouts: number,
  intakeOpen: boolean | undefined = true
): string | null {
  if (openTryouts > 0) {
    return '/eventos#seletivas';
  }

  if (intakeOpen === false) {
    return null;
  }

  return showJoinInvite(enabled, openTryouts, intakeOpen) ? '/times#quero-jogar' : '/interesse';
}

/**
 * Convite para jogar no time, em destaque (página Times). Com seletiva aberta, o botão
 * principal leva às inscrições; sem nenhuma, o principal é deixar o contato. Com os
 * contatos fechados, não oferece deixar o contato.
 */
export function JoinTeamCta({
  openTryouts,
  intakeOpen = true
}: {
  readonly openTryouts: number;
  readonly intakeOpen?: boolean | undefined;
}) {
  const contact = intakeOpen !== false;

  return (
    <section id="quero-jogar" className="join-cta" aria-labelledby="join-cta-title">
      <Icon name="megaphone" className="join-cta-icon" />
      <div className="join-cta-text">
        <h2 id="join-cta-title">Quer jogar com a gente?</h2>
        <p>
          {openTryouts > 0
            ? `${openTryouts === 1 ? 'Há 1 seletiva aberta' : `Há ${openTryouts} seletivas abertas`} agora. ${contact ? 'Inscreva-se ou deixe seu contato para as próximas.' : 'Inscreva-se pela página da seletiva.'}`
            : 'Nenhuma seletiva aberta agora. Deixe seu contato e avisamos quando abrir a próxima.'}
        </p>
      </div>
      <div className="join-cta-actions">
        {openTryouts > 0 ? (
          <>
            <Link href="/eventos#seletivas" className="btn btn-primary">
              Ver seletivas abertas
            </Link>
            {contact ? (
              <Link href="/interesse" className="btn join-cta-ghost">
                Deixar meu contato
              </Link>
            ) : null}
          </>
        ) : (
          <Link href="/interesse" className="btn btn-primary">
            Deixar meu contato
          </Link>
        )}
      </div>
    </section>
  );
}
