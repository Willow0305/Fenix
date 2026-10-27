import type { ReactNode } from 'react';

import { CARD_TYPE, type CardDesign, type MemberCard } from '../lib/card-types';
import { formatDate } from '../lib/format';
import { Avatar } from './avatar';
import { BrandLogo } from './brand-logo';

/**
 * Frente da carteirinha (DT-068 F), na proporção de cartão (85,6 × 54 mm). O modelo e a
 * imagem de fundo vêm das configurações; o QR entra pelo `qr` (do celular ou impresso).
 */
export function MemberCardFront({
  card,
  design,
  qr
}: {
  readonly card: MemberCard;
  readonly design: CardDesign;
  readonly qr?: ReactNode;
}) {
  const logo =
    design.useTeamLogo && card.team?.logoUrl ? card.team.logoUrl : design.officialLogoUrl;

  return (
    <article
      className={`member-card member-card-${design.template.toLowerCase()}`}
      style={design.backgroundUrl ? { backgroundImage: `url(${design.backgroundUrl})` } : undefined}
      aria-label={`Carteirinha de ${CARD_TYPE[card.type].toLowerCase()} de ${card.holderName}`}
    >
      <header className="member-card-head">
        <BrandLogo src={logo ?? undefined} alt="" size={36} />
        <div>
          <strong>{design.teamName}</strong>
          <span>Carteirinha de {CARD_TYPE[card.type].toLowerCase()}</span>
        </div>
      </header>
      <div className="member-card-body">
        <Avatar src={card.photo} name={card.holderName} size={64} />
        <div className="member-card-info">
          <strong className="member-card-name">{card.holderName}</strong>
          {card.team ? <span>{card.team.name}</span> : null}
          {card.endsOn ? <span>Válida até {formatDate(card.endsOn)}</span> : null}
          <span className="member-card-code">{card.code}</span>
        </div>
        {qr ? <div className="member-card-qr">{qr}</div> : null}
      </div>
    </article>
  );
}

/** SVG do QR vindo da API (gerado no servidor, sem conteúdo do usuário). */
export function QrImage({ svg, label }: { readonly svg: string; readonly label: string }) {
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={label}
      className="member-card-qr-img"
    />
  );
}
