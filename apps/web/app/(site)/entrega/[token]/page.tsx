'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Icon } from '../../../../components/icon';
import {
  Alert,
  ErrorSummary,
  Loading,
  PageHeader,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api-client';
import type { CourierLink } from '../../../../lib/delivery-types';
import { formatDateTime, formatPhoneDisplay } from '../../../../lib/format';

/**
 * Link do entregador (DT-075, RN-ENT-007): sem login, só o necessário para esta entrega.
 * Na porta, o cliente diz o código de 4 dígitos; se não der, uma foto com quem recebeu.
 */
export default function CourierPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<CourierLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [receivedBy, setReceivedBy] = useState('');
  const load = useCallback(async () => {
    try {
      setView(await api<CourierLink>(`/public/deliveries/${token}`, { auth: false }));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }, [token]);
  const confirm = useSubmit(async () => {
    setView(
      await api<CourierLink>(`/public/deliveries/${token}/code`, {
        method: 'POST',
        body: { code },
        auth: false
      })
    );
  });
  const send = useSubmit(async () => {
    if (!photo) {
      return;
    }

    const body = new FormData();

    body.set('file', photo);

    if (receivedBy.trim()) {
      body.set('receivedBy', receivedBy.trim());
    }

    setView(
      await api<CourierLink>(`/public/deliveries/${token}/photo`, {
        method: 'POST',
        body,
        auth: false
      })
    );
  });

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !view) {
    return (
      <div className="container stack courier-page">
        <PageHeader title="Entrega" />
        <Alert kind="error">{error}</Alert>
      </div>
    );
  }

  if (!view) {
    return <Loading />;
  }

  if (view.status !== 'OUT') {
    return (
      <div className="container stack courier-page">
        <PageHeader title="Entrega registrada" />
        <Alert kind="success">Obrigado! A entrega foi registrada no sistema do Fênix.</Alert>
      </div>
    );
  }

  const a = view.address;
  const mapQuery = a
    ? encodeURIComponent(`${a.street}, ${a.number}, ${a.neighborhood}, ${a.city} - ${a.state}`)
    : '';

  return (
    <div className="container stack courier-page">
      <PageHeader
        title={`Entrega ${view.orderNumber}`}
        description={`Para ${view.customerFirstName ?? 'o cliente'}${view.expiresAt ? ` · link vale até ${formatDateTime(view.expiresAt)}` : ''}`}
      />
      {a ? (
        <section className="card stack gap-sm" aria-labelledby="endereco">
          <h2 id="endereco" className="m-0">
            Endereço
          </h2>
          <p className="m-0 text-break">
            {a.street}, {a.number}
            {a.complement ? `, ${a.complement}` : ''} — {a.neighborhood}, {a.city}/{a.state}
          </p>
          {a.reference ? <p className="muted m-0">Referência: {a.reference}</p> : null}
          <div className="row gap-sm">
            <a
              className="btn btn-secondary btn-sm"
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="geo-alt" /> Abrir no mapa
            </a>
            {a.phone ? (
              <a className="btn btn-secondary btn-sm" href={`tel:${a.phone.replace(/\D/g, '')}`}>
                <Icon name="telephone" /> Ligar {formatPhoneDisplay(a.phone)}
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <form className="card stack" onSubmit={(event) => void confirm.submit(event)}>
        <h2 className="m-0">Código do cliente</h2>
        <p className="m-0">Peça os 4 números ao cliente quando entregar.</p>
        <ErrorSummary error={confirm.error} />
        <TextField
          label="Código"
          numeric="integer"
          maxLength={4}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint={`${view.codeAttemptsLeft} tentativa(s) restante(s).`}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={code.length !== 4 || confirm.pending || view.codeAttemptsLeft === 0}
        >
          Confirmar entrega
        </button>
      </form>

      <form className="card stack" onSubmit={(event) => void send.submit(event)}>
        <h2 className="m-0">Sem código? Tire uma foto</h2>
        <p className="m-0">Foto do pacote entregue (na porta ou com quem recebeu).</p>
        <ErrorSummary error={send.error} />
        <div className="field">
          <label htmlFor="foto-entrega">Foto</label>
          <input
            id="foto-entrega"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        <TextField
          label="Quem recebeu (opcional)"
          maxLength={120}
          value={receivedBy}
          onChange={(e) => setReceivedBy(e.target.value)}
          placeholder="Maria, mãe"
        />
        <button type="submit" className="btn btn-secondary" disabled={!photo || send.pending}>
          Enviar foto e registrar entrega
        </button>
      </form>
    </div>
  );
}
