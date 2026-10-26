import type { Metadata } from 'next';

import { Icon } from '../../../components/icon';
import { mailtoLink, whatsappLink } from '../../../lib/contact-links';
import { formatPhoneDisplay } from '../../../lib/format';
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
  // Atendimento é pelo WhatsApp e pelo e-mail do clube; o site não tem chat (DT-048).
  const whatsapp = whatsappLink(team.phone, `Olá, ${team.teamName}! Vim pelo site.`);
  const mailto = mailtoLink(team.email, `Contato pelo site — ${team.teamName}`);

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Contato</h1>
      {whatsapp || mailto ? (
        <div className="card stack">
          <p className="m-0">
            Fale com a diretoria pelo WhatsApp ou por e-mail. Respondemos por lá mesmo.
          </p>
          <div className="form-actions">
            {whatsapp ? (
              <a
                className="btn btn-primary"
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="whatsapp" /> Conversar no WhatsApp
              </a>
            ) : null}
            {mailto ? (
              <a className="btn btn-secondary" href={mailto}>
                <Icon name="envelope" /> Enviar e-mail
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {hasContact ? (
        <div className="card stack">
          {team.email ? (
            <p>
              <Icon name="envelope" className="icon-lead" /> <strong>E-mail:</strong>{' '}
              <a href={mailto ?? undefined} className="text-break">
                {team.email}
              </a>
            </p>
          ) : null}
          {team.phone ? (
            <p>
              <Icon name="whatsapp" className="icon-lead" /> <strong>Telefone/WhatsApp:</strong>{' '}
              {formatPhoneDisplay(team.phone)}
            </p>
          ) : null}
          {address.length > 0 ? (
            <p>
              <Icon name="geo-alt" className="icon-lead" /> <strong>Endereço:</strong>{' '}
              {address.join(', ')}
            </p>
          ) : null}
          {team.socialLinks.length > 0 ? (
            <ul>
              {team.socialLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <Icon name="box-arrow-up-right" /> {link.label}
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
