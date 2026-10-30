'use client';

import { useEffect, useState } from 'react';

import { StarInput } from '../../../../components/stars';
import { Alert, ErrorSummary, TextArea, useSubmit } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { type MyReview, REVIEW_STATUS } from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';

/** Formulário de avaliação (DT-081): aparece só para quem comprou e recebeu o produto. */
export function ReviewForm({ productId }: { readonly productId: string }) {
  const { status } = useAuth();
  const mine = useResource<MyReview>(
    status === 'authenticated' ? `/me/reviews/${productId}` : null
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [missingRating, setMissingRating] = useState(false);
  const [sent, setSent] = useState(false);
  const review = mine.data?.review ?? null;

  useEffect(() => {
    if (review) {
      setRating(review.rating);
      setComment(review.comment ?? '');
    }
  }, [review]);

  const save = useSubmit(async () => {
    if (rating === 0) {
      setMissingRating(true);
      return;
    }

    await api(`/me/reviews/${productId}`, { method: 'PUT', body: { rating, comment } });
    setSent(true);
    await mine.reload();
  });

  if (!mine.data?.canReview) {
    return null;
  }

  return (
    <form className="card stack review-form" onSubmit={(event) => void save.submit(event)}>
      <h3 className="m-0">{review ? 'Sua avaliação' : 'Avalie este produto'}</h3>
      {review ? (
        <p className="m-0">
          <span className={`badge ${REVIEW_STATUS[review.status].badge}`}>
            {REVIEW_STATUS[review.status].label}
          </span>
          {review.status === 'REJECTED' && review.moderationReason ? (
            <span className="muted"> Motivo: {review.moderationReason}</span>
          ) : null}
        </p>
      ) : null}
      <StarInput
        value={rating}
        onChange={(value) => {
          setRating(value);
          setMissingRating(false);
        }}
      />
      {missingRating ? <span className="field-error">Escolha de 1 a 5 estrelas.</span> : null}
      <TextArea
        label="Comentário (opcional)"
        maxLength={1000}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <ErrorSummary error={save.error} />
      {sent ? (
        <Alert kind="success">Recebemos sua avaliação. Ela aparece aqui depois de aprovada.</Alert>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          {save.pending ? 'Enviando…' : review ? 'Atualizar avaliação' : 'Enviar avaliação'}
        </button>
        <small className="muted">A diretoria aprova antes de aparecer no site.</small>
      </div>
    </form>
  );
}
