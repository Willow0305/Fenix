'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert, Empty, Loading, PageHeader, Pagination } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { formatDateTime } from '../../../../lib/format';
import type { NotificationItem } from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const list = useResource<Page<NotificationItem>>('/me/notifications', { page, pageSize: 20 });

  async function markRead(id: string) {
    await api(`/me/notifications/${id}/read`, { method: 'POST' });
    await list.reload();
  }

  async function markAll() {
    await api('/me/notifications/read-all', { method: 'POST' });
    await list.reload();
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void markAll()}>
            Marcar todas como lidas
          </button>
        }
      />
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Você não tem notificações.</Empty> : null}
      {list.data?.data.map((item) => (
        <article
          key={item.id}
          className="card stack"
          style={{
            borderLeft: item.readAt ? undefined : '4px solid var(--color-primary)',
            gap: '0.35rem'
          }}
        >
          <div className="row">
            <strong>{item.title}</strong>
            {item.readAt ? null : <span className="badge badge-brand">Nova</span>}
            <span className="spacer" />
            <small className="muted">{formatDateTime(item.createdAt)}</small>
          </div>
          <p style={{ margin: 0 }}>{item.message}</p>
          <div className="row">
            {item.link ? <Link href={item.link}>Ver detalhes</Link> : null}
            {item.readAt ? null : (
              <button type="button" className="btn btn-link" onClick={() => void markRead(item.id)}>
                Marcar como lida
              </button>
            )}
          </div>
        </article>
      ))}
      {list.data ? <Pagination {...list.data.meta} onChange={setPage} /> : null}
    </>
  );
}
