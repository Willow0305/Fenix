import Link from 'next/link';

import { BrandLogo } from '../../components/brand-logo';
import { Icon } from '../../components/icon';
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
            </div>
          </div>
          <div className={styles.heroLogo}>
            <BrandLogo src={logo?.url} alt={logo?.altText ?? undefined} size={320} />
          </div>
        </div>
      </section>

      {membership ? (
        <div className={`container ${styles.section} ${styles.membership}`}>
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
        <div className={styles.sectionHead}>
          <h2 id="times-title">Nossos times</h2>
        </div>
        <div className={styles.cards}>
          <Link href="/times?tipo=MALE" className={styles.teamCard}>
            <BrandLogo src={male} alt="" size={64} />
            <div>
              <strong>Masculino</strong>
              <span>Elenco e agenda</span>
            </div>
            <Icon name="arrow-right" className={styles.teamArrow} />
          </Link>
          <Link href="/times?tipo=FEMALE" className={styles.teamCard}>
            <BrandLogo src={female} alt="" size={64} />
            <div>
              <strong>Feminino</strong>
              <span>Elenco e agenda</span>
            </div>
            <Icon name="arrow-right" className={styles.teamArrow} />
          </Link>
          <Link href="/seletivas" className={styles.teamCard}>
            <span className={styles.teamIcon}>
              <Icon name="clipboard-check" />
            </span>
            <div>
              <strong>Seletivas</strong>
              <span>Venha jogar com a gente</span>
            </div>
            <Icon name="arrow-right" className={styles.teamArrow} />
          </Link>
        </div>
      </section>

      <HomeHighlights />
    </>
  );
}
