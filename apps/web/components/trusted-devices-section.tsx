'use client';

import { useRef } from 'react';

import { api } from '../lib/api-client';
import { formatDateTime } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Icon } from './icon';
import { Alert, Empty, ErrorSummary, useSubmit } from './ui';

interface TrustedDevice {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}

/**
 * Navegadores que não pedem o código da segunda etapa (DT-050). A pessoa vê onde está
 * lembrada e pode esquecer um ou todos; trocar a senha esquece todos.
 */
export function TrustedDevicesSection() {
  const devices = useResource<TrustedDevice[]>('/auth/trusted-devices');
  const target = useRef<string | null>(null);
  const forget = useSubmit(async () => {
    const id = target.current;

    await api(id ? `/auth/trusted-devices/${id}` : '/auth/trusted-devices', { method: 'DELETE' });
    await devices.reload();
    forget.setMessage(id ? 'Dispositivo esquecido.' : 'Todos os dispositivos foram esquecidos.');
  });

  function run(id: string | null) {
    target.current = id;
    void forget.submit();
  }

  const list = devices.data ?? [];

  return (
    <section className="card stack" aria-labelledby="dispositivos">
      <h2 id="dispositivos">
        <Icon name="laptop" className="icon-lead" /> Dispositivos lembrados
      </h2>
      <p className="muted m-0">
        Nestes navegadores você entra só com a senha, sem o código do autenticador, por até 30 dias
        desde que foram lembrados.
      </p>
      {forget.message ? <Alert kind="success">{forget.message}</Alert> : null}
      <ErrorSummary error={forget.error} />
      {devices.error ? <Alert kind="error">{devices.error}</Alert> : null}
      {devices.data && list.length === 0 ? <Empty>Nenhum dispositivo lembrado.</Empty> : null}
      {list.length > 0 ? (
        <ul className="stack gap-sm m-0" style={{ listStyle: 'none', padding: 0 }}>
          {list.map((device) => (
            <li key={device.id} className="row">
              <span className="stack m-0" style={{ gap: '0.1rem', flex: '1 1 16rem' }}>
                <strong>
                  {device.label}
                  {device.current ? <span className="badge badge-brand"> este</span> : null}
                </strong>
                <small className="muted">
                  Último uso em {formatDateTime(device.lastUsedAt)} · vale até{' '}
                  {formatDateTime(device.expiresAt)}
                </small>
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={forget.pending}
                onClick={() => run(device.id)}
              >
                Esquecer
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {list.length > 1 ? (
        <div>
          <button
            type="button"
            className="btn btn-link"
            disabled={forget.pending}
            onClick={() => run(null)}
          >
            Esquecer todos
          </button>
        </div>
      ) : null}
    </section>
  );
}
