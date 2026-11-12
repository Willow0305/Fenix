import type { Metadata } from 'next';
import Link from 'next/link';

import { LiveRefresh } from '../../../components/live-refresh';
import { Icon } from '../../../components/icon';
import type { Page } from '../../../lib/api-types';
import type { Benefit } from '../../../lib/card-types';
import { formatMoney, plural } from '../../../lib/format';
import { serverGet } from '../../../lib/server-api';
import type { ProductDetail, ProductSummary } from '../../../lib/store-types';
import { affiliateOffer } from './affiliate-offer';
import styles from './afiliacao.module.scss';

export const metadata: Metadata = {
  title: 'Seja afiliado',
  description:
    'Carteirinha digital de afiliado do Fênix Vôlei: desconto nos parceiros do clube com um QR no celular.'
};

/** Frase de destaque revelada palavra por palavra ao rolar (só CSS, DT-081). */
const TAGLINE = 'Cada carteirinha ajuda o Fênix a renascer a cada jogo.';

/**
 * Página de venda da afiliação (Onda 1, docs/31): uma oferta, um público, uma ação. Tudo vem
 * dos planos de afiliação à venda e dos benefícios ativos dos parceiros; nada é inventado.
 */
export default async function AffiliationPage() {
  const [plans, allBenefits] = await Promise.all([
    serverGet<Page<ProductSummary>>('/public/products?membership=true&pageSize=10', 30),
    serverGet<Benefit[]>('/public/benefits', 60)
  ]);
  const plan = plans?.data[0];
  // A validade em meses só vem no detalhe do produto.
  const planDetail = plan
    ? await serverGet<ProductDetail>(`/public/products/${encodeURIComponent(plan.slug)}`, 30)
    : null;
  const offer = affiliateOffer(allBenefits ?? []);
  const cta = plan ? (
    <Link href={`/loja/${plan.slug}`} className={`btn btn-primary ${styles.cta}`}>
      Quero ser afiliado · {formatMoney(plan.priceFrom.amount)}
    </Link>
  ) : null;

  return (
    <>
      <LiveRefresh topics={['store', 'benefits']} />
      <section className={styles.hero} aria-labelledby="afiliacao-titulo">
        <div className={`container ${styles.heroInner}`}>
          <p className={styles.eyebrow}>Afiliação Fênix</p>
          <h1 id="afiliacao-titulo">
            Torça pelo Fênix
            <br /> e pague menos nos parceiros
          </h1>
          <p className={styles.lead}>
            Uma carteirinha digital no seu celular dá desconto em lojas e serviços parceiros do
            clube. É só mostrar o QR na hora de pagar.
          </p>
          {cta ?? (
            <p className={styles.closed}>
              As afiliações estão fechadas no momento. Fique de olho nas notícias do clube.
            </p>
          )}
          {offer.partnerCount > 0 ? (
            <p className={styles.proof}>
              <Icon name="patch-check" /> {plural(offer.partnerCount, 'parceiro', 'parceiros')} ·
              descontos de até {offer.maxDiscount}%
            </p>
          ) : null}
        </div>
      </section>

      <div className={`container ${styles.body}`}>
        {offer.benefits.length > 0 ? (
          <section aria-labelledby="beneficios" className={styles.section}>
            <h2 id="beneficios">Descontos de quem é afiliado</h2>
            <ul className={styles.benefits}>
              {offer.benefits.map((benefit) => (
                <li key={benefit.id} className={styles.benefit}>
                  <span className={styles.discount}>{Number(benefit.discountPercent)}%</span>
                  <div>
                    <strong>{benefit.partner.name}</strong>
                    <span>{benefit.title}</span>
                    {benefit.conditions ? <small>{benefit.conditions}</small> : null}
                  </div>
                </li>
              ))}
            </ul>
            <p className="m-0">
              <Link href="/parceiros" className="back-link">
                Conhecer os parceiros <Icon name="chevron-right" />
              </Link>
            </p>
          </section>
        ) : null}

        <section aria-labelledby="como-funciona" className={styles.section}>
          <h2 id="como-funciona">Como funciona</h2>
          <ol className={styles.steps}>
            <li>
              <strong>Compre o plano na loja</strong>
              <span>Com a sua conta. Pode comprar também para outras pessoas.</span>
            </li>
            <li>
              <strong>A carteirinha aparece na sua conta</strong>
              <span>Assim que o pagamento é confirmado, em Minha conta › Carteirinhas.</span>
            </li>
            <li>
              <strong>Mostre o QR no parceiro</strong>
              <span>O parceiro lê o código e aplica o desconto.</span>
            </li>
          </ol>
        </section>

        <section className={styles.tagline} aria-label="Por que se afiliar">
          <p>
            {TAGLINE.split(' ').map((word, index) => (
              <span key={`${word}-${index}`} style={{ '--i': index } as React.CSSProperties}>
                {word}{' '}
              </span>
            ))}
          </p>
        </section>

        <section aria-labelledby="perguntas" className={styles.section}>
          <h2 id="perguntas">Perguntas frequentes</h2>
          <div className={styles.faq}>
            {planDetail?.membershipMonths ? (
              <details>
                <summary>Por quanto tempo a carteirinha vale?</summary>
                <p>
                  {plural(planDetail.membershipMonths, 'mês', 'meses')} a partir da confirmação do
                  pagamento. Se você renovar antes de vencer, o novo período soma ao que ainda
                  falta.
                </p>
              </details>
            ) : null}
            <details>
              <summary>Vou pagar de novo sozinho quando vencer?</summary>
              <p>
                Não. Não existe renovação automática: avisamos 15 dias antes de vencer e você renova
                só se quiser.
              </p>
            </details>
            <details>
              <summary>Posso comprar para outra pessoa?</summary>
              <p>
                Pode. No carrinho você informa o nome completo de cada beneficiário. Com o e-mail de
                uma conta do site, a carteirinha aparece direto na conta dela. A carteirinha é
                pessoal e intransferível.
              </p>
            </details>
            <details>
              <summary>Como uso o desconto?</summary>
              <p>
                Abra Minha conta › Carteirinhas e mostre o QR. Ele muda a cada minuto, por isso
                captura de tela não vale. Se preferir, imprima a carteirinha no tamanho de cartão.
              </p>
            </details>
            <details>
              <summary>Preciso ter conta no site?</summary>
              <p>
                Sim. A carteirinha fica guardada na sua conta, e é por ela que você acompanha a
                validade.
              </p>
            </details>
            <details>
              <summary>Os parceiros e descontos mudam?</summary>
              <p>
                Podem mudar. Os descontos que valem hoje aparecem nesta página, na página de cada{' '}
                <Link href="/parceiros">parceiro</Link> e na própria carteirinha.
              </p>
            </details>
          </div>
        </section>

        {cta ? (
          <section className={styles.final} aria-labelledby="afiliar-final">
            <h2 id="afiliar-final">Pronto para torcer pagando menos?</h2>
            {cta}
          </section>
        ) : null}
      </div>
    </>
  );
}
