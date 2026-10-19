import Link from 'next/link';

import type { PublicTeam } from '../lib/api-types';
import styles from './site-footer.module.scss';

export function SiteFooter({ team }: { readonly team: PublicTeam }) {
  const city = [team.address.city, team.address.state].filter(Boolean).join(' — ');

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div>
          <strong className={styles.title}>{team.officialName}</strong>
          {team.description ? <p>{team.description}</p> : null}
        </div>
        <div>
          <strong className={styles.title}>Contato</strong>
          <ul>
            {team.email ? (
              <li>
                <a href={`mailto:${team.email}`}>{team.email}</a>
              </li>
            ) : null}
            {team.phone ? <li>{team.phone}</li> : null}
            {city ? <li>{city}</li> : null}
            {team.socialLinks.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label} <span className="visually-hidden">(abre em nova aba)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <strong className={styles.title}>Institucional</strong>
          <ul>
            <li>
              <Link href="/termos">Termos de uso</Link>
            </li>
            <li>
              <Link href="/privacidade">Política de privacidade</Link>
            </li>
            <li>
              <Link href="/interesse">Quero jogar no Fênix</Link>
            </li>
          </ul>
        </div>
      </div>
      <p className={`container ${styles.copy}`}>
        © {new Date().getFullYear()} {team.teamName}. Todos os direitos reservados.
      </p>
    </footer>
  );
}
