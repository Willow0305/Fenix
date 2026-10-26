'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api-client';
import type { Page } from '../lib/api-types';
import { useAuth } from '../lib/auth-context';
import { onRealtime } from '../lib/realtime';
import type { NotificationItem } from '../lib/sports-types';
import { Icon } from './icon';

const VISIBLE_MS = 7_000;
const MAX_TOASTS = 3;

interface Toast {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly link: string | null;
}

/**
 * Avisos flutuantes em tempo real (DT-061): quando chega uma notificação nova, ela surge no
 * canto superior direito e some sozinha em 7 s (pausa com o mouse ou o foco em cima).
 * Só mostra o que chegou depois de a página abrir; o sino continua com a lista completa.
 */
export function LiveToasts() {
  const { status } = useAuth();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(new Set<string>());
  const openedAt = useRef(Date.now());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function dismiss(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function schedule(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => dismiss(id), VISIBLE_MS)
    );
  }

  useEffect(() => {
    if (status !== 'authenticated') {
      return undefined;
    }

    openedAt.current = Date.now();

    return onRealtime((message) => {
      if (message.type !== 'notification') {
        return;
      }

      void api<Page<NotificationItem>>('/me/notifications', {
        query: { unread: true, pageSize: 5 }
      })
        .then((page) => {
          const fresh = page.data.filter(
            (item) =>
              !seen.current.has(item.id) &&
              new Date(item.createdAt).getTime() >= openedAt.current - 5_000
          );

          fresh.forEach((item) => {
            seen.current.add(item.id);
            schedule(item.id);
          });

          if (fresh.length > 0) {
            setToasts((current) =>
              [
                ...fresh.map((item) => ({
                  id: item.id,
                  title: item.title,
                  message: item.message,
                  link: item.link
                })),
                ...current
              ].slice(0, MAX_TOASTS)
            );
          }
        })
        .catch(() => undefined);
    });
  }, [status]);

  useEffect(() => {
    const pending = timers.current;

    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <div className="toast-region" role="region" aria-label="Avisos novos" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          onMouseEnter={() => clearTimeout(timers.current.get(toast.id))}
          onMouseLeave={() => schedule(toast.id)}
          onFocus={() => clearTimeout(timers.current.get(toast.id))}
          onBlur={() => schedule(toast.id)}
        >
          <Icon name="bell-fill" className="toast-icon" />
          <button
            type="button"
            className="toast-body"
            onClick={() => {
              dismiss(toast.id);

              if (toast.link) {
                router.push(toast.link);
              }
            }}
          >
            <strong className="text-break">{toast.title}</strong>
            <span className="text-break">{toast.message}</span>
          </button>
          <button
            type="button"
            className="toast-close"
            aria-label="Fechar aviso"
            onClick={() => dismiss(toast.id)}
          >
            <Icon name="x-lg" />
          </button>
        </div>
      ))}
    </div>
  );
}
