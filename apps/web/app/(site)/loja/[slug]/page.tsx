import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { LiveRefresh } from '../../../../components/live-refresh';
import { ProductCard } from '../../../../components/product-card';
import { ProductGallery } from '../../../../components/product-gallery';
import type { Page } from '../../../../lib/api-types';
import type { Campaign } from '../../../../lib/campaign-types';
import { formatDate, formatDateTime } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';
import { FULFILLMENT, type ProductDetail, type ProductSummary } from '../../../../lib/store-types';
import { ProductPurchase } from './product-purchase';
import { ProductReviewsSection } from './product-reviews';

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

  const [campaign, sameCategory] = await Promise.all([
    product.campaign
      ? serverGet<Campaign[]>('/public/campaigns', 30).then((rows) =>
          (rows ?? []).find((item) => item.slug === product.campaign?.slug)
        )
      : undefined,
    // "Mais da categoria": vitrine do que já está à venda, sem regra nova.
    serverGet<Page<ProductSummary>>(
      `/public/products?category=${encodeURIComponent(product.category.slug)}&pageSize=5`,
      60
    )
  ]);
  const related = (sameCategory?.data ?? []).filter((item) => item.id !== product.id).slice(0, 4);
  const physical = product.fulfillmentType !== 'MEMBERSHIP';

  return (
    <div className="container product-page">
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
      <div className="product-layout">
        <div className="product-media">
          <ProductGallery images={product.images} productName={product.name} />
        </div>
        <div className="stack product-info">
          <span className="muted">
            {product.category.name}
            {product.partner ? ` · vendido por ${product.partner.name}` : ''}
          </span>
          <h1 className="product-title">{product.name}</h1>
          {product.brand ? <span className="muted">Marca: {product.brand}</span> : null}
          <span className="badge badge-brand product-fulfillment">
            {FULFILLMENT[product.fulfillmentType]}
          </span>
          {product.campaign ? (
            <section className="alert alert-info stack gap-xs" aria-labelledby="prevenda">
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
                  pagas. Se não forem, a remessa é cancelada e você recebe de volta 100% do valor
                  pago.
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
            <section className="alert alert-info stack gap-xs">
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
          {physical ? (
            <ul className="trust-list" aria-label="Garantias da compra">
              <li>
                <Icon name="qr-code" /> Pagamento por PIX
              </li>
              <li>
                <Icon name="arrow-counterclockwise" /> 7 dias para desistir depois de receber
                (exceto personalizados)
              </li>
              <li>
                <Icon name="shield-check" /> 90 dias de garantia contra defeito
              </li>
            </ul>
          ) : null}
          {product.description ? (
            <section className="stack gap-sm" aria-labelledby="descricao-produto">
              <h2 id="descricao-produto" className="h-small m-0">
                Descrição
              </h2>
              <p className="prose m-0">{product.description}</p>
            </section>
          ) : null}
          {product.pickupInstructions ? (
            <div className="card">
              <strong>Retirada</strong>
              <p className="prose m-0">{product.pickupInstructions}</p>
            </div>
          ) : null}
        </div>
      </div>
      {physical ? <ProductReviewsSection productId={product.id} slug={product.slug} /> : null}
      {related.length > 0 ? (
        <section className="related-products" aria-labelledby="relacionados">
          <h2 id="relacionados">Mais em {product.category.name}</h2>
          <div className="card-grid related-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
