'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Icon } from '../../../../components/icon';
import { MemberCardFront, QrImage } from '../../../../components/member-card';
import { Alert, Empty, Loading, PageHeader } from '../../../../components/ui';
import {
  CARD_TYPE,
  type CardDesign,
  type CardQr,
  type MemberCard,
  type MyCards
} from '../../../../lib/card-types';
import { useResource } from '../../../../lib/use-resource';

const DEFAULT_DESIGN: CardDesign = {
  template: 'CLASSIC',
  useTeamLogo: true,
  teamName: 'Fênix Vôlei',
  officialLogoUrl: null,
  backgroundUrl: null
};

/** QR do celular: busca de novo quando o código muda (a cada minuto). */
function LiveQr({ card }: { readonly card: MemberCard }) {
  const qr = useResource<CardQr>(`/me/cards/${card.id}/qr`);
  const { reload } = qr;
  const refreshIn = qr.data?.refreshInMs ?? null;

  useEffect(() => {
    if (refreshIn === null) {
      return;
    }

    const timer = window.setTimeout(() => void reload(), refreshIn + 500);

    return () => window.clearTimeout(timer);
  }, [refreshIn, reload]);

  if (!qr.data) {
    return <span className="muted">Carregando QR…</span>;
  }

  return <QrImage svg={qr.data.qrSvg} label={`QR da carteirinha ${card.code}`} />;
}

function CardBlock({ card, design }: { readonly card: MemberCard; readonly design: CardDesign }) {
  const valid = card.state === 'VALID';

  return (
    <section className="card stack" aria-labelledby={`cart-${card.id}`}>
      <h2 id={`cart-${card.id}`} style={{ margin: 0 }}>
        {CARD_TYPE[card.type]}
        {card.purchasedForOther ? ` · comprada para ${card.holderName}` : ''}
      </h2>
      <MemberCardFront card={card} design={design} qr={valid ? <LiveQr card={card} /> : null} />
      {valid ? (
        <p className="muted" style={{ margin: 0 }}>
          Mostre o QR na entrada dos jogos ou na loja parceira. Ele muda a cada minuto: print não
          vale.
        </p>
      ) : (
        <Alert kind="warning">
          {card.state === 'SUSPENDED'
            ? 'Carteirinha suspensa. Fale com a diretoria.'
            : card.state === 'EXPIRED'
              ? 'Afiliação vencida. Renove para voltar a usar os benefícios.'
              : card.state === 'ATHLETE_INACTIVE'
                ? 'A carteirinha de atleta vale enquanto você estiver ativo no time.'
                : card.stateLabel}
        </Alert>
      )}
      {valid ? (
        <div className="row">
          <Link
            href={`/imprimir/carteirinha/${card.id}`}
            className="btn btn-secondary btn-sm"
            target="_blank"
          >
            <Icon name="printer" /> Imprimir
          </Link>
        </div>
      ) : null}
      {card.benefits.length > 0 ? (
        <details className="collapsible">
          <summary>Benefícios em parceiros ({card.benefits.length})</summary>
          <ul className="stack" style={{ gap: '0.4rem', paddingLeft: '1.1rem' }}>
            {card.benefits.map((b) => (
              <li key={b.id}>
                <strong>{b.discountPercent}%</strong> em {b.partner.name}: {b.title}
                {b.partner.details ? <span className="muted"> · {b.partner.details}</span> : null}
                {b.conditions ? <span className="muted"> ({b.conditions})</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Carteirinhas da conta: de atleta (automática) e de afiliado (comprada) (DT-068). */
export default function MyCardsPage() {
  const data = useResource<MyCards>('/me/cards');

  return (
    <>
      <PageHeader
        title="Carteirinhas"
        description="Identificação no clube e descontos em parceiros."
      />
      {data.error ? <Alert kind="error">{data.error}</Alert> : null}
      {data.loading && !data.data ? <Loading /> : null}
      {data.data?.cards.length === 0 ? (
        <Empty>
          Você ainda não tem carteirinha. Atletas ativos recebem a de atleta automaticamente;
          qualquer pessoa pode ter a de afiliado comprando uma afiliação na{' '}
          <Link href="/loja">loja</Link>.
        </Empty>
      ) : null}
      {data.data
        ? data.data.cards.map((card) => (
            <CardBlock key={card.id} card={card} design={data.data?.design ?? DEFAULT_DESIGN} />
          ))
        : null}
    </>
  );
}
