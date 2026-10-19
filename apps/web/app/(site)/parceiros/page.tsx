import type { Metadata } from 'next';
import Link from 'next/link';

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
        <div className="card">
          <p>Nenhum parceiro publicado no momento.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))'
          }}
        >
          {partners.map((partner) => (
            <article key={partner.id} className="card stack">
              {partner.logoUrl ? (
                <img
                  src={partner.logoUrl}
                  alt={`Logo de ${partner.displayName}`}
                  width={96}
                  height={96}
                  style={{ objectFit: 'contain' }}
                />
              ) : null}
              <h2 style={{ margin: 0 }}>
                <Link href={`/parceiros/${partner.id}`}>{partner.displayName}</Link>
              </h2>
              <span className="badge">{PARTNER_TYPE[partner.type]}</span>
              {partner.description ? (
                <p style={{ margin: 0 }}>{partner.description.slice(0, 180)}</p>
              ) : null}
              {partner.services.length > 0 ? (
                <small className="muted">
                  {partner.services.length} serviço(s) com agendamento
                </small>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
