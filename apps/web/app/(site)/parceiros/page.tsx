import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '../../../components/icon';
import { MediaImage } from '../../../components/media-image';
import { PartnerLogo } from '../../../components/partner-logo';
import { PARTNER_TYPE, type PublicPartner } from '../../../lib/partner-types';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Parceiros' };
export const revalidate = 60;

export default async function PartnersPage() {
  const partners = (await serverGet<PublicPartner[]>('/public/partners', 60)) ?? [];

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Parceiros</h1>
      <p className="muted">
        Empresas e profissionais aprovados pela diretoria do Fênix Vôlei, com contrato vigente.
      </p>
      {partners.length === 0 ? (
        <div className="card empty">
          <p>Nenhum parceiro publicado no momento.</p>
        </div>
      ) : (
        <div className="card-grid" style={{ '--card-min': '280px' } as React.CSSProperties}>
          {partners.map((partner) => (
            <article key={partner.id} className="content-card partner-card">
              <Link href={`/parceiros/${partner.id}`} tabIndex={-1} aria-hidden="true">
                <MediaImage
                  src={partner.coverUrl}
                  alt=""
                  fallbackSrc={partner.logoUrl ?? undefined}
                  fallbackTone="light"
                />
              </Link>
              <div className="content-card-body">
                <PartnerLogo src={partner.logoUrl} name={partner.displayName} />
                <h2 className="content-card-title line-clamp-2" title={partner.displayName}>
                  <Link href={`/parceiros/${partner.id}`}>{partner.displayName}</Link>
                </h2>
                <span className="badge" style={{ justifySelf: 'start' }}>
                  {PARTNER_TYPE[partner.type]}
                </span>
                {partner.description ? <p className="line-clamp-3">{partner.description}</p> : null}
                {partner.services.length > 0 ? (
                  <small className="muted">
                    <Icon name="calendar-check" /> {partner.services.length} serviço(s) com
                    agendamento
                  </small>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
