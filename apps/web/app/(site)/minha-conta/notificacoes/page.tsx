'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '../../../../components/icon';
import { NotificationPreferencesSection } from '../../../../components/notification-preferences';
import { Alert, Empty, Loading, PageHeader, Pagination } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { formatDateTime } from '../../../../lib/format';
import { refreshOwnResources } from '../../../../lib/realtime';
import type { NotificationItem } from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const list = useResource<Page<NotificationItem>>('/me/notifications', { page, pageSize: 20 });

  async function markRead(id: string) {
    await api(`/me/notifications/${id}/read`, { method: 'POST' });
    refreshOwnResources();
  }

  async function markAll() {
    await api('/me/notifications/read-all', { method: 'POST' });
    refreshOwnResources();
  }

  async function remove(id: string) {
    await api(`/me/notifications/${id}`, { method: 'DELETE' });
    refreshOwnResources();
  }

  async function removeRead() {
    await api('/me/notifications/read', { method: 'DELETE' });
    refreshOwnResources();
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void markAll()}
            >
              <Icon name="check2-all" /> Marcar todas como lidas
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void removeRead()}
            >
              <Icon name="trash3" /> Apagar as lidas
            </button>
          </>
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
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-link"
              aria-label={`Apagar a notificação ${item.title}`}
              onClick={() => void remove(item.id)}
            >
              <Icon name="trash3" /> Apagar
            </button>
          </div>
        </article>
      ))}
      {list.data ? <Pagination {...list.data.meta} onChange={setPage} /> : null}
      <NotificationPreferencesSection />
    </>
  );
}
