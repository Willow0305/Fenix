import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { LiveRefresh } from '../../../../components/live-refresh';
import { ProductGallery } from '../../../../components/product-gallery';
import type { Campaign } from '../../../../lib/campaign-types';
import { formatDate, formatDateTime } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';
import { FULFILLMENT, type ProductDetail } from '../../../../lib/store-types';
import { ProductPurchase } from './product-purchase';

async function load(slug: string): Promise<ProductDetail | null> {
  return serverGet<ProductDetail>(`/public/products/${encodeURIComponent(slug)}`, 30);
}

export async function generateMetadata({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await load((await params).slug);

  return {
    title: product?.name ?? 'Produto',
    description: product?.description?.slice(0, 160) ?? undefined
  };
}

export default async function ProductPage({
  params
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const product = await load((await params).slug);

  if (product === null) {
    notFound();
  }

  const campaign = product.campaign
    ? ((await serverGet<Campaign[]>('/public/campaigns', 30)) ?? []).find(
        (item) => item.slug === product.campaign?.slug
      )
    : undefined;

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <LiveRefresh topics={['store']} />
      <nav aria-label="Você está em" className="breadcrumbs">
        <Link href="/loja">Loja</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/loja?categoria=${encodeURIComponent(product.category.slug)}`}>
          {product.category.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-break">
          {product.name}
        </span>
      </nav>
      <div
        style={{
          display: 'grid',
          gap: '2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))'
        }}
      >
        <ProductGallery images={product.images} productName={product.name} />
        <div className="stack">
          <span className="muted">
            {product.category.name}
            {product.partner ? ` · vendido por ${product.partner.name}` : ''}
          </span>
          <h1 style={{ margin: 0 }}>{product.name}</h1>
          {product.brand ? <span className="muted">Marca: {product.brand}</span> : null}
          <span className="badge badge-brand" style={{ justifySelf: 'start' }}>
            {FULFILLMENT[product.fulfillmentType]}
          </span>
          {product.campaign ? (
            <section
              className="alert alert-info stack"
              aria-labelledby="prevenda"
              style={{ gap: '0.4rem' }}
            >
              <strong id="prevenda">
                <Icon name="clock-history" /> Pré-venda até{' '}
                {formatDateTime(product.campaign.salesEndAt)}
              </strong>
              <span>
                Este produto será encomendado ao fornecedor depois do fim das vendas da remessa{' '}
                <strong>{product.campaign.name}</strong>.
              </span>
              {campaign?.minimumQuantity ? (
                <span>
                  A encomenda só acontece se forem atingidas {campaign.minimumQuantity} unidades
                  pagas.
                </span>
              ) : null}
              {campaign?.expectedArrivalOn ? (
                <span>Previsão de chegada: {formatDate(campaign.expectedArrivalOn)}.</span>
              ) : null}
              {campaign?.refundPolicy ? (
                <span className="prose">{campaign.refundPolicy}</span>
              ) : null}
            </section>
          ) : null}
          {product.fulfillmentType === 'MEMBERSHIP' ? (
            <section className="alert alert-info stack" style={{ gap: '0.4rem' }}>
              <strong>
                <Icon name="person-vcard" /> Carteirinha de afiliado
                {product.membershipMonths ? `, válida por ${product.membershipMonths} meses` : ''}
              </strong>
              <span>
                Dá desconto nos <Link href="/parceiros">parceiros do clube</Link>. Comprando mais de
                uma, você informa no carrinho o nome de cada beneficiário. Uso pessoal e
                intransferível; renovar soma ao período que ainda falta.
              </span>
            </section>
          ) : null}
          {product.productionLeadDays ? (
            <p className="muted">Prazo de produção: cerca de {product.productionLeadDays} dias.</p>
          ) : null}
          {product.availableUntil ? (
            <p className="muted">Disponível até {formatDateTime(product.availableUntil)}.</p>
          ) : null}
          <ProductPurchase product={product} />
          {product.description ? <p className="prose">{product.description}</p> : null}
          {product.pickupInstructions ? (
            <div className="card">
              <strong>Retirada</strong>
              <p className="prose" style={{ margin: 0 }}>
                {product.pickupInstructions}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
