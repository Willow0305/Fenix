import type { Metadata } from 'next';
import Link from 'next/link';

import { Icon } from '../../../components/icon';
import { MediaImage } from '../../../components/media-image';
import { PartnerLogo } from '../../../components/partner-logo';
import type { Benefit } from '../../../lib/card-types';
import { PARTNER_TYPE, type PublicPartner } from '../../../lib/partner-types';
import { serverGet } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Parceiros' };
export const revalidate = 60;

export default async function PartnersPage() {
  const partners = (await serverGet<PublicPartner[]>('/public/partners', 60)) ?? [];
  const benefits = (await serverGet<Benefit[]>('/public/benefits', 60)) ?? [];
  // Maior desconto de cada parceiro, para o selo do cartão (DT-068 D).
  const bestDiscount = new Map<string, number>();

  for (const benefit of benefits) {
    const id = benefit.partner.id;

    if (id) {
      bestDiscount.set(id, Math.max(bestDiscount.get(id) ?? 0, Number(benefit.discountPercent)));
    }
  }

  // Lojas sem cadastro no site: o desconto vale, mas não há página do parceiro (DT-074).
  const informal = benefits.filter((benefit) => benefit.partner.id === null);

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Parceiros</h1>
      <p className="muted">
        Empresas e profissionais aprovados pela diretoria do Fênix Vôlei, com contrato vigente.
      </p>
      {benefits.length > 0 ? (
        <p className="card" style={{ margin: 0 }}>
          <Icon name="person-vcard" /> Com a carteirinha do Fênix (atleta ou afiliado), você tem
          desconto nos parceiros marcados. Mostre o QR em{' '}
          <Link href="/minha-conta/carteirinhas">Minha conta → Carteirinhas</Link>.
        </p>
      ) : null}
      {partners.length === 0 && informal.length === 0 ? (
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
                {bestDiscount.has(partner.id) ? (
                  <span className="badge badge-success" style={{ justifySelf: 'start' }}>
                    Até {bestDiscount.get(partner.id)}% com a carteirinha
                  </span>
                ) : null}
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
      {informal.length > 0 ? (
        <section className="card stack" aria-labelledby="outros-descontos">
          <h2 id="outros-descontos" className="m-0">
            Outros descontos com a carteirinha
          </h2>
          <ul className="stack list-plain">
            {informal.map((benefit) => (
              <li key={benefit.id}>
                <strong>{benefit.discountPercent}%</strong> em{' '}
                <strong>{benefit.partner.name}</strong>: {benefit.title}
                {benefit.partner.details ? (
                  <div className="muted">{benefit.partner.details}</div>
                ) : null}
                {benefit.conditions ? <div className="muted">{benefit.conditions}</div> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
