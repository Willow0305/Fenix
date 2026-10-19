import type { Metadata } from 'next';

import { getPublicTeam } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Contato' };

export default async function ContactPage() {
  const team = await getPublicTeam();
  const address = [
    team.address.line1,
    team.address.line2,
    [team.address.city, team.address.state].filter(Boolean).join(' — '),
    team.address.postalCode
  ].filter(Boolean);
  const hasContact = team.email || team.phone || address.length > 0 || team.socialLinks.length > 0;

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Contato</h1>
      {hasContact ? (
        <div className="card stack">
          {team.email ? (
            <p>
              <strong>E-mail:</strong> <a href={`mailto:${team.email}`}>{team.email}</a>
            </p>
          ) : null}
          {team.phone ? (
            <p>
              <strong>Telefone/WhatsApp:</strong> {team.phone}
            </p>
          ) : null}
          {address.length > 0 ? (
            <p>
              <strong>Endereço:</strong> {address.join(', ')}
            </p>
          ) : null}
          {team.socialLinks.length > 0 ? (
            <ul>
              {team.socialLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="muted">Os canais de contato serão publicados em breve.</p>
      )}
    </div>
  );
}
