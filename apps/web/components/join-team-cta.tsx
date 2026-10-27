import Link from 'next/link';

import { Icon } from './icon';

/**
 * Convite para jogar no time, em destaque (página Times). Com seletiva aberta, o botão
 * principal leva às inscrições; sem nenhuma, o principal é deixar o contato.
 */
export function JoinTeamCta({ openTryouts }: { readonly openTryouts: number }) {
  return (
    <section className="join-cta" aria-labelledby="join-cta-title">
      <Icon name="megaphone" className="join-cta-icon" />
      <div className="join-cta-text">
        <h2 id="join-cta-title">Quer jogar com a gente?</h2>
        <p>
          {openTryouts > 0
            ? `${openTryouts === 1 ? 'Há 1 seletiva aberta' : `Há ${openTryouts} seletivas abertas`} agora. Inscreva-se ou deixe seu contato para as próximas.`
            : 'Nenhuma seletiva aberta agora. Deixe seu contato e avisamos quando abrir a próxima.'}
        </p>
      </div>
      <div className="join-cta-actions">
        {openTryouts > 0 ? (
          <>
            <Link href="/seletivas" className="btn btn-primary">
              Ver seletivas abertas
            </Link>
            <Link href="/interesse" className="btn join-cta-ghost">
              Deixar meu contato
            </Link>
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
