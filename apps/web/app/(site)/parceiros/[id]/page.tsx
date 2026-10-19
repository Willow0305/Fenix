import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatMoney } from '../../../../lib/format';
import { PARTNER_TYPE, type PublicPartner } from '../../../../lib/partner-types';
import { serverGet } from '../../../../lib/server-api';

async function load(id: string): Promise<PublicPartner | null> {
  return /^[0-9a-f-]{36}$/i.test(id)
    ? serverGet<PublicPartner>(`/public/partners/${id}`, 60)
    : null;
}

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const partner = await load((await params).id);

  return {
    title: partner?.displayName ?? 'Parceiro',
    description: partner?.description?.slice(0, 160) ?? undefined
  };
}

export default async function PartnerPage({
  params
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const partner = await load((await params).id);

  if (partner === null) {
    notFound();
  }

  return (
    <div className="container stack" style={{ paddingTop: '2rem' }}>
      <p>
        <Link href="/parceiros">← Parceiros</Link>
      </p>
      <div className="row">
        {partner.logoUrl ? (
          <img
            src={partner.logoUrl}
            alt={`Logo de ${partner.displayName}`}
            width={112}
            height={112}
            style={{ objectFit: 'contain' }}
          />
        ) : null}
        <div className="stack">
          <h1 style={{ margin: 0 }}>{partner.displayName}</h1>
          <span className="badge">{PARTNER_TYPE[partner.type]}</span>
          {partner.websiteUrl ? (
            <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">
              Site do parceiro
            </a>
          ) : null}
        </div>
      </div>
      {partner.description ? <p style={{ whiteSpace: 'pre-line' }}>{partner.description}</p> : null}

      {partner.services.length > 0 ? (
        <section className="stack" aria-labelledby="servicos">
          <h2 id="servicos">Serviços</h2>
          {partner.services.map((service) => (
            <article key={service.id} className="card stack">
              <div className="row">
                <h3 style={{ margin: 0 }}>{service.name}</h3>
                <span className="muted">
                  {service.durationMinutes} min ·{' '}
                  {service.price ? formatMoney(service.price.amount) : 'valor a combinar'}
                </span>
              </div>
              {service.professional ? (
                <small className="muted">Com {service.professional.fullName}</small>
              ) : null}
              {service.description ? <p style={{ margin: 0 }}>{service.description}</p> : null}
              <Link
                href={`/parceiros/servicos/${service.id}`}
                className="btn btn-primary"
                style={{ justifySelf: 'start' }}
              >
                Solicitar horário
              </Link>
            </article>
          ))}
        </section>
      ) : null}

      {partner.professionals.length > 0 ? (
        <section className="stack" aria-labelledby="profissionais">
          <h2 id="profissionais">Profissionais</h2>
          {partner.professionals.map((pro) => (
            <article key={pro.id} className="card stack">
              <strong>{pro.fullName}</strong>
              <span className="muted">{pro.profession}</span>
              {pro.publicBio ? <p style={{ margin: 0 }}>{pro.publicBio}</p> : null}
              {pro.email || pro.phone ? (
                <small>{[pro.phone, pro.email].filter(Boolean).join(' · ')}</small>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {partner.products.length > 0 ? (
        <section className="stack" aria-labelledby="produtos">
          <h2 id="produtos">Produtos na loja</h2>
          <ul>
            {partner.products.map((product) => (
              <li key={product.id}>
                <Link href={`/loja/${product.slug}`}>{product.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
