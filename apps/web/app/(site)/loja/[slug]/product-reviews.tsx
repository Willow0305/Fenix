import { Stars } from '../../../../components/stars';
import { formatDate, plural } from '../../../../lib/format';
import { serverGet } from '../../../../lib/server-api';
import type { ProductReviews } from '../../../../lib/store-types';
import { ReviewForm } from './review-form';

/**
 * Avaliações do produto (DT-081): média, total e as aprovadas pela diretoria, com o primeiro
 * nome. Quem comprou e recebeu vê o formulário logo abaixo.
 */
export async function ProductReviewsSection({
  productId,
  slug
}: {
  readonly productId: string;
  readonly slug: string;
}) {
  const data = await serverGet<ProductReviews>(
    `/public/products/${encodeURIComponent(slug)}/reviews`,
    60
  );

  return (
    <section className="product-reviews" aria-labelledby="avaliacoes">
      <div className="product-reviews-head">
        <h2 id="avaliacoes">Avaliações</h2>
        {data && data.count > 0 && data.average !== null ? (
          <p className="product-reviews-summary">
            <strong>{data.average.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</strong>
            <Stars value={data.average} />
            <span className="muted">{plural(data.count, 'avaliação', 'avaliações')}</span>
          </p>
        ) : (
          <p className="muted m-0">Ainda sem avaliações. Quem comprou e recebeu pode avaliar.</p>
        )}
      </div>
      {data && data.reviews.length > 0 ? (
        <ul className="review-list">
          {data.reviews.map((review) => (
            <li key={review.id}>
              <div className="row">
                <Stars value={review.rating} size="sm" />
                <strong>{review.author}</strong>
                <span className="muted">{formatDate(review.createdAt.slice(0, 10))}</span>
              </div>
              {review.comment ? <p className="prose m-0">{review.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ReviewForm productId={productId} />
    </section>
  );
}
