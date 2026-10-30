'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Stars } from '../../../components/stars';
import {
  Alert,
  ConfirmDialog,
  Empty,
  PageHeader,
  Pagination,
  Skeleton
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatDateTime } from '../../../lib/format';
import { type AdminReview, REVIEW_STATUS, type ReviewStatus } from '../../../lib/store-types';
import { useResource } from '../../../lib/use-resource';

const TABS: readonly (readonly [ReviewStatus, string])[] = [
  ['PENDING', 'Para aprovar'],
  ['APPROVED', 'Publicadas'],
  ['REJECTED', 'Não publicadas']
];

/** Avaliações de produto (DT-081): a diretoria aprova antes de aparecer no site. */
export default function ReviewsAdminPage() {
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const [page, setPage] = useState(1);
  const list = useResource<Page<AdminReview>>('/store/reviews', { status, page, pageSize: 20 });
  const [rejecting, setRejecting] = useState<AdminReview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(review: AdminReview, decision: 'APPROVE' | 'REJECT', reason?: string) {
    setError(null);

    try {
      await api(`/store/reviews/${review.id}/moderate`, {
        method: 'POST',
        body: { decision, ...(reason ? { reason } : {}) }
      });
      setNotice(
        decision === 'APPROVE'
          ? `Avaliação de ${review.product.name} publicada.`
          : `Avaliação de ${review.product.name} recusada. A pessoa recebeu o motivo.`
      );
      await list.reload();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Avaliações de quem comprou e recebeu. Só aparecem no site depois de aprovadas."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}
      <div className="row" role="group" aria-label="Situação">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${status === value ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Skeleton lines={4} /> : null}
      {list.data?.data.length === 0 ? (
        <Empty>
          {status === 'PENDING' ? 'Nenhuma avaliação esperando aprovação.' : 'Nada por aqui.'}
        </Empty>
      ) : null}
      {list.data?.data.map((review) => (
        <article key={review.id} className="card stack review-admin">
          <div className="row">
            <Stars value={review.rating} size="sm" />
            <Link href={`/loja/${review.product.slug}`}>{review.product.name}</Link>
            <span className="muted">
              {review.author} · {formatDateTime(review.createdAt)}
            </span>
            <span className="spacer" />
            <span className={`badge ${REVIEW_STATUS[review.status].badge}`}>
              {REVIEW_STATUS[review.status].label}
            </span>
          </div>
          {review.comment ? (
            <p className="prose m-0">{review.comment}</p>
          ) : (
            <p className="muted m-0">Sem comentário, só a nota.</p>
          )}
          {review.status === 'REJECTED' && review.moderationReason ? (
            <p className="muted m-0">Motivo: {review.moderationReason}</p>
          ) : null}
          <div className="row">
            {review.status !== 'APPROVED' ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void moderate(review, 'APPROVE')}
              >
                Publicar
              </button>
            ) : null}
            {review.status !== 'REJECTED' ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRejecting(review)}
              >
                {review.status === 'APPROVED' ? 'Tirar do site' : 'Não publicar'}
              </button>
            ) : null}
          </div>
        </article>
      ))}
      {list.data ? (
        <Pagination
          page={page}
          pageSize={list.data.meta.pageSize}
          total={list.data.meta.total}
          onChange={setPage}
        />
      ) : null}
      <ConfirmDialog
        open={rejecting !== null}
        title={`Não publicar a avaliação de ${rejecting?.product.name ?? ''}`}
        description="A pessoa recebe o motivo e pode editar a avaliação, que volta para a fila."
        confirmLabel="Não publicar"
        requireReason
        onConfirm={async (reason) => {
          if (rejecting) {
            await moderate(rejecting, 'REJECT', reason);
          }

          setRejecting(null);
        }}
        onClose={() => setRejecting(null)}
      />
    </>
  );
}
