import Link from 'next/link';

import { Icon } from './icon';

/**
 * "Afiliações abertas" no Início (DT-068), no mesmo destaque do convite da página Times.
 * Só aparece enquanto houver afiliação à venda.
 */
export function MembershipCta({
  product
}: {
  readonly product: { name: string; slug: string; price: string };
}) {
  return (
    <section className="join-cta" aria-labelledby="afiliacao-cta">
      <Icon name="person-vcard" className="join-cta-icon" />
      <div className="join-cta-text">
        <h2 id="afiliacao-cta">Afiliações abertas</h2>
        <p>
          Torça com o Fênix e ganhe descontos nos parceiros do clube com a carteirinha de afiliado.{' '}
          {product.name}: {product.price}.
        </p>
      </div>
      <div className="join-cta-actions">
        <Link href={`/loja/${product.slug}`} className="btn btn-primary">
          Quero ser afiliado
        </Link>
        <Link href="/parceiros" className="btn join-cta-ghost">
          Ver descontos
        </Link>
      </div>
    </section>
  );
}
