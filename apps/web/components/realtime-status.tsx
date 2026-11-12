'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { onRealtimeStatus, realtimeStatus } from '../lib/realtime';
import { Icon } from './icon';

/** Quedas curtas (troca de rede, renovação da conexão) não precisam de aviso. */
const SHOW_AFTER_MS = 4_000;

/**
 * Aviso discreto de conexão em tempo real (DT-116): aparece só quando a conexão cai e não
 * volta em alguns segundos. Ao voltar, some sozinho e as telas abertas se atualizam.
 */
export function RealtimeStatus() {
  const status = useSyncExternalStore(onRealtimeStatus, realtimeStatus, () => 'off' as const);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'reconnecting') {
      setVisible(false);

      return undefined;
    }

    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);

    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="realtime-status-region" role="status">
      {visible ? (
        <p className="realtime-status">
          <Icon name="wifi-off" />
          Sem atualização automática. Reconectando…
        </p>
      ) : null}
    </div>
  );
}
