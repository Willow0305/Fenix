import Link from 'next/link';

import { BrandLogo } from '../../components/brand-logo';
import { MembershipCta } from '../../components/membership-cta';
import { firstTeamLogo } from '../../lib/brand';
import { getPublicTeam, serverGet } from '../../lib/server-api';
import type { Page } from '../../lib/api-types';
import { formatMoney } from '../../lib/format';
import type { Team } from '../../lib/sports-types';
import type { ProductSummary } from '../../lib/store-types';
import styles from './home.module.scss';
import { HomeHighlights } from './home-highlights';

export default async function HomePage() {
  const [team, teams, memberships] = await Promise.all([
    getPublicTeam(),
    serverGet<Team[]>('/public/teams').then((rows) => rows ?? []),
    // Bloco "Afiliações abertas" só enquanto houver afiliação à venda (DT-068).
    serverGet<Page<ProductSummary>>('/public/products?membership=true&pageSize=1')
  ]);
  const membership = memberships?.data[0];
  const logo = team.brandAssets.OFFICIAL;
  const male = firstTeamLogo(teams, 'MALE') ?? logo?.url;
  const female = firstTeamLogo(teams, 'FEMALE') ?? logo?.url;

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

      {membership ? (
        <div className={`container ${styles.section}`} style={{ paddingBottom: 0 }}>
          <MembershipCta
            product={{
              name: membership.name,
              slug: membership.slug,
              price: formatMoney(membership.priceFrom.amount)
            }}
          />
        </div>
      ) : null}

      <section className={`container ${styles.section}`} aria-labelledby="times-title">
        <h2 id="times-title">Nossos times</h2>
        <div className={styles.cards}>
          <Link href="/times?tipo=MALE" className={styles.teamCard}>
            <BrandLogo src={male} alt="Logo do time masculino" size={64} />
            <strong>Masculino</strong>
            <span>Elenco, agenda e notícias do time masculino.</span>
          </Link>
          <Link href="/times?tipo=FEMALE" className={styles.teamCard}>
            <BrandLogo src={female} alt="Logo do time feminino" size={64} />
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
