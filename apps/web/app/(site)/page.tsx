import Link from 'next/link';

import { LiveRefresh } from '../../components/live-refresh';
import { BrandLogo } from '../../components/brand-logo';
import { Icon } from '../../components/icon';
import { joinTeamHref } from '../../components/join-team-cta';
import { MembershipCta } from '../../components/membership-cta';
import { PhoenixLoop } from '../../components/phoenix-motion';
import { firstTeamLogo, firstTeamPhoto } from '../../lib/brand';
import { getPublicTeam, serverGet } from '../../lib/server-api';
import type { Page } from '../../lib/api-types';
import { formatMoney } from '../../lib/format';
import type { Team, Tryout } from '../../lib/sports-types';
import { responsiveSrcSet } from '../../lib/image-url';
import type { ProductSummary } from '../../lib/store-types';
import styles from './home.module.scss';
import { HomeHighlights } from './home-highlights';

export default async function HomePage() {
  const [team, teams, memberships, openTryouts] = await Promise.all([
    getPublicTeam(),
    serverGet<Team[]>('/public/teams').then((rows) => rows ?? []),
    // Bloco "Afiliações abertas" só enquanto houver afiliação à venda (DT-068).
    serverGet<Page<ProductSummary>>('/public/products?membership=true&pageSize=1'),
    serverGet<Tryout[]>('/public/tryouts?scope=open', 30).then((rows) => rows ?? [])
  ]);
  const membership = memberships?.data[0];
  const joinHref = joinTeamHref(
    team.joinInviteEnabled,
    openTryouts.length,
    team.interestIntakeOpen
  );
  const logo = team.brandAssets.OFFICIAL;
  const male = firstTeamLogo(teams, 'MALE') ?? logo?.url;
  const female = firstTeamLogo(teams, 'FEMALE') ?? logo?.url;
  const malePhoto = firstTeamPhoto(teams, 'MALE');
  const femalePhoto = firstTeamPhoto(teams, 'FEMALE');

  return (
    <>
      <LiveRefresh
        topics={['news', 'events', 'teams', 'tryouts', 'store', 'campaigns', 'settings']}
      />
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>{team.officialName}</p>
            <h1 id="hero-title">Renascer a cada jogo.</h1>
            <p className={styles.lead}>
              {team.description ?? 'Vôlei com garra, comunidade e paixão pela quadra.'}
            </p>
            <div className={styles.ctas}>
              {/* Seletivas ficam em Eventos (DT-099); sem nenhuma aberta, o convite de Times. */}
              {/* Contatos fechados e nenhuma seletiva aberta: o botão some (DT-107). */}
              {joinHref ? (
                <Link href={joinHref} className="btn btn-primary">
                  Quero jogar no Fênix
                </Link>
              ) : null}
              <Link href="/loja" className={`btn ${styles.ghost}`}>
                Loja oficial
              </Link>
            </div>
          </div>
          <div className={styles.heroLogo}>
            <PhoenixLoop
              fallback={<BrandLogo src={logo?.url} alt={logo?.altText ?? undefined} size={320} />}
            />
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
          <Link
            href="/times?tipo=MALE"
            className={`${styles.teamCard}${malePhoto ? ` ${styles.withPhoto}` : ''}`}
          >
            {malePhoto ? (
              <img
                className={styles.teamPhoto}
                src={malePhoto}
                srcSet={responsiveSrcSet(malePhoto)}
                sizes="(min-width: 64rem) 32rem, 100vw"
                alt=""
              />
            ) : null}
            <BrandLogo src={male} alt="" size={64} />
            <div>
              <strong>Masculino</strong>
              <span>Elenco e agenda</span>
            </div>
            <Icon name="arrow-right" className={styles.teamArrow} />
          </Link>
          <Link
            href="/times?tipo=FEMALE"
            className={`${styles.teamCard}${femalePhoto ? ` ${styles.withPhoto}` : ''}`}
          >
            {femalePhoto ? (
              <img
                className={styles.teamPhoto}
                src={femalePhoto}
                srcSet={responsiveSrcSet(femalePhoto)}
                sizes="(min-width: 64rem) 32rem, 100vw"
                alt=""
              />
            ) : null}
            <BrandLogo src={female} alt="" size={64} />
            <div>
              <strong>Feminino</strong>
              <span>Elenco e agenda</span>
            </div>
            <Icon name="arrow-right" className={styles.teamArrow} />
          </Link>
        </div>
      </section>

      <HomeHighlights />
    </>
  );
}
