'use client';

import Link from 'next/link';

import { useResource } from '../lib/use-resource';
import { Icon } from './icon';

/** Sino com a contagem de notificações não lidas; atualiza em tempo real (DT-049). */
export function NotificationBell({ onNavigate }: { readonly onNavigate?: () => void }) {
  const unread = useResource<{ count: number }>('/me/notifications/unread-count');
  const count = unread.data?.count ?? 0;
  const label =
    count === 0 ? 'Notificações' : `Notificações: ${count} não lida${count === 1 ? '' : 's'}`;

  return (
    <Link
      href="/minha-conta/notificacoes"
      className="btn btn-secondary btn-sm notification-bell"
      aria-label={label}
      title={label}
      onClick={onNavigate}
    >
      <Icon name={count > 0 ? 'bell-fill' : 'bell'} />
      {count > 0 ? (
        <span className="notification-count" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
