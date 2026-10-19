import Link from 'next/link';

import { BrandLogo } from '../../components/brand-logo';
import { getPublicTeam } from '../../lib/server-api';
import styles from './home.module.scss';
import { HomeHighlights } from './home-highlights';

export default async function HomePage() {
  const team = await getPublicTeam();
  const logo = team.brandAssets.OFFICIAL;

  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>{team.officialName}</p>
            <h1 id="hero-title">Renascer a cada jogo.</h1>
            <p className={styles.lead}>
              {team.description ?? 'Vôlei com garra, comunidade e paixão pela quadra.'}
            </p>
            <div className={styles.ctas}>
              <Link href="/seletivas" className="btn btn-primary">
                Quero jogar no Fênix
              </Link>
              <Link href="/loja" className={`btn ${styles.ghost}`}>
                Loja oficial
              </Link>
              <Link href="/contato" className={`btn ${styles.ghost}`}>
                Fale conosco
              </Link>
            </div>
          </div>
          <div className={styles.heroLogo}>
            <BrandLogo src={logo?.url} alt={logo?.altText ?? undefined} size={320} />
          </div>
        </div>
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="times-title">
        <h2 id="times-title">Nossos times</h2>
        <div className={styles.cards}>
          <Link href="/times?tipo=MALE" className={styles.teamCard}>
            <strong>Masculino</strong>
            <span>Elenco, agenda e notícias do time masculino.</span>
          </Link>
          <Link href="/times?tipo=FEMALE" className={styles.teamCard}>
            <strong>Feminino</strong>
            <span>Elenco, agenda e notícias do time feminino.</span>
          </Link>
          <Link href="/seletivas" className={styles.teamCard}>
            <strong>Seletivas</strong>
            <span>Veja as seletivas abertas e faça sua inscrição.</span>
          </Link>
        </div>
      </section>

      <HomeHighlights />
    </>
  );
}
