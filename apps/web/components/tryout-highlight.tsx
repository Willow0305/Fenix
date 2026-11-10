'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { daysLeft, formatDateTime, plural } from '../lib/format';
import type { Tryout } from '../lib/sports-types';
import { HighlightCarousel } from './highlight-carousel';
import { Icon } from './icon';

/** De quanto em quanto tempo a página confere se alguma seletiva fechou com ela aberta. */
const RECHECK_MS = 30_000;

/** Seletivas cujo prazo de inscrição ainda não passou neste instante. */
export function stillOpen(tryouts: readonly Tryout[], now: number): Tryout[] {
  return tryouts.filter(
    (tryout) =>
      tryout.acceptingRegistrations &&
      (tryout.registrationEndsAt === null || new Date(tryout.registrationEndsAt).getTime() >= now)
  );
}

function deadline(tryout: Tryout): string | null {
  if (!tryout.registrationEndsAt) {
    return null;
  }

  const days = daysLeft(tryout.registrationEndsAt);
  const until = formatDateTime(tryout.registrationEndsAt);

  return days <= 1
    ? `Último dia: inscrições até ${until}`
    : `Faltam ${plural(days, 'dia', 'dias')}: inscrições até ${until}`;
}

function TryoutSlide({ tryout, titleId }: { tryout: Tryout; titleId: string }) {
  const details = [
    tryout.team?.name,
    tryout.startsAt ? formatDateTime(tryout.startsAt) : 'Data a definir',
    tryout.location
  ].filter(Boolean);
  const slotsLeft = tryout.maxSlots === null ? null : tryout.maxSlots - tryout.usedSlots;
  const limit = deadline(tryout);

  return (
    <>
      <div className="campaign-highlight-text">
        <span className="campaign-highlight-tag">
          <Icon name="clipboard-check" /> Seletiva aberta
        </span>
        <h2 id={titleId}>{tryout.title}</h2>
        <p>{details.join(' · ')}</p>
        {limit ? <p className="campaign-highlight-deadline">{limit}</p> : null}
      </div>
      <div className="campaign-highlight-side tryout-highlight-side">
        {slotsLeft !== null && slotsLeft > 0 ? (
          <p className="campaign-highlight-deadline">
            {plural(slotsLeft, 'vaga restante', 'vagas restantes')}
          </p>
        ) : null}
        <Link href={`/seletivas/${tryout.slug}`} className="btn btn-primary">
          Inscrever-se
        </Link>
      </div>
    </>
  );
}

/**
 * Seletivas abertas no topo da página Eventos (DT-099), no tom do "Afiliações abertas": só
 * as que aceitam inscrição agora (a API filtra: aberta, dentro do período e com vaga). Com
 * mais de uma, o mesmo carrossel da pré-venda. Quando o prazo de uma acaba com a página
 * aberta, o cartão dela some sozinho; sem nenhuma, nada aparece.
 */
export function TryoutHighlight({ tryouts }: { readonly tryouts: readonly Tryout[] }) {
  // Só depois de montar: no servidor a lista já veio filtrada pela API.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), RECHECK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const open = now === null ? [...tryouts] : stillOpen(tryouts, now);

  if (open.length === 0) {
    return null;
  }

  return (
    <div id="seletivas" className="tryout-highlight">
      <HighlightCarousel
        items={open}
        idPrefix="seletiva-destaque"
        labels={{ region: 'Seletivas abertas', item: 'seletiva' }}
        itemName={(tryout) => tryout.title}
        renderSlide={(tryout, titleId) => <TryoutSlide tryout={tryout} titleId={titleId} />}
      />
    </div>
  );
}
