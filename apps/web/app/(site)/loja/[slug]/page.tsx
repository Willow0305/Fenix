import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatDateTime } from '../../../../lib/format';
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

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <p>
        <Link href="/loja">← Voltar para a loja</Link>
      </p>
      <div
        style={{
          display: 'grid',
          gap: '2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))'
        }}
      >
        <div className="stack">
          {product.images.length > 0 ? (
            product.images.map((image) => (
              <img
                key={image.id}
                src={image.url}
                alt={image.altText ?? product.name}
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: '#fff'
                }}
              />
            ))
          ) : (
            <div
              className="card empty"
              style={{ aspectRatio: '1', display: 'grid', placeItems: 'center' }}
            >
              Sem imagem
            </div>
          )}
        </div>
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
            <div className="alert alert-info">
              Produto da remessa <strong>{product.campaign.name}</strong>: será encomendado ao
              fornecedor após o encerramento das vendas.
            </div>
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
