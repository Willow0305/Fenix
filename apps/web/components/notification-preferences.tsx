'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';

import { api } from '../lib/api-client';
import { formatDateTime, formatPhoneDisplay } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Icon } from './icon';
import { Alert, ErrorSummary, Loading, useSubmit } from './ui';

type Channel = 'EMAIL' | 'WHATSAPP';

export interface NotificationPreferences {
  readonly email: string;
  readonly whatsapp: {
    readonly available: boolean;
    readonly testMode: boolean;
    readonly consentedAt: string | null;
    readonly phone: string | null;
  };
  readonly categories: readonly {
    readonly category: string;
    readonly label: string;
    readonly email: boolean;
    readonly whatsapp: boolean;
  }[];
}

interface Job {
  readonly path: string;
  readonly body: unknown;
  readonly message: string;
}

/**
 * Canais por finalidade e consentimento para WhatsApp (DT-048). O aviso no painel sempre
 * existe; e-mail e WhatsApp são escolha da pessoa, e WhatsApp só depois do aceite.
 */
export function NotificationPreferencesSection() {
  const prefs = useResource<NotificationPreferences>('/me/notifications/preferences');
  const consentId = useId();
  const [agreed, setAgreed] = useState(false);
  const job = useRef<Job | null>(null);
  const action = useSubmit(async () => {
    const current = job.current;

    if (!current) {
      return;
    }

    try {
      prefs.setData(
        await api<NotificationPreferences>(current.path, { method: 'PUT', body: current.body })
      );
      setAgreed(false);
      action.setMessage(current.message);
    } catch (error) {
      // A tela volta ao que está gravado antes de mostrar o erro.
      await prefs.reload();
      throw error;
    }
  });

  function run(path: string, body: unknown, message: string) {
    job.current = { path, body, message };
    void action.submit();
  }

  function toggle(category: string, channel: Channel, enabled: boolean) {
    run(
      '/me/notifications/preferences',
      { items: [{ category, channel, enabled }] },
      'Preferência salva.'
    );
  }

  function consent(accept: boolean) {
    run(
      '/me/notifications/whatsapp-consent',
      { accept },
      accept
        ? 'Pronto: você vai receber os avisos marcados também por WhatsApp.'
        : 'Você não vai mais receber avisos por WhatsApp.'
    );
  }

  if (prefs.loading && !prefs.data) {
    return <Loading />;
  }

  if (!prefs.data) {
    return prefs.error ? <Alert kind="error">{prefs.error}</Alert> : null;
  }

  const { whatsapp } = prefs.data;
  const whatsappOn = whatsapp.available && whatsapp.consentedAt !== null;

  return (
    <details className="card stack collapsible">
      <summary>
        <Icon name="gear" className="icon-lead" /> Como receber os avisos (e-mail e WhatsApp)
      </summary>
      <p className="muted m-0">
        Todo aviso aparece aqui em Notificações. Você também pode receber por e-mail (
        <span className="text-break">{prefs.data.email}</span>) ou por WhatsApp. Avisos por WhatsApp
        não saem entre 21h e 8h.
      </p>

      {action.message ? <Alert kind="success">{action.message}</Alert> : null}
      <ErrorSummary error={action.error} />

      <div className="stack gap-sm">
        <h3 className="m-0 h-small">
          <Icon name="whatsapp" className="icon-lead" /> WhatsApp{' '}
          {whatsapp.testMode ? <span className="badge">modo de teste</span> : null}
        </h3>
        {!whatsapp.available ? (
          <p className="muted m-0">Os avisos por WhatsApp ainda não estão ativos no Fênix.</p>
        ) : whatsapp.consentedAt ? (
          <div className="row">
            <span>
              Ativo para <strong>{formatPhoneDisplay(whatsapp.phone)}</strong> desde{' '}
              {formatDateTime(whatsapp.consentedAt)}.
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={action.pending}
              onClick={() => consent(false)}
            >
              Parar de receber por WhatsApp
            </button>
          </div>
        ) : !whatsapp.phone ? (
          <p className="m-0">
            Para receber por WhatsApp, cadastre um celular com DDD em{' '}
            <Link href="/minha-conta">Meus dados</Link>.
          </p>
        ) : (
          <div className="stack gap-sm">
            <label className="checkbox" htmlFor={consentId}>
              <input
                id={consentId}
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                Aceito receber avisos do Fênix Vôlei por WhatsApp no número{' '}
                <strong>{formatPhoneDisplay(whatsapp.phone)}</strong>, nas finalidades marcadas
                abaixo. Posso parar quando quiser, aqui mesmo.
              </span>
            </label>
            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!agreed || action.pending}
                onClick={() => consent(true)}
              >
                <Icon name="whatsapp" /> Ativar WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ margin: 0 }}>
        Notícias do clube, eventos e jogos e novos tópicos do fórum só chegam para quem marcar
        e-mail ou WhatsApp abaixo.
      </p>
      <div className="table-wrap">
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Finalidade</th>
              <th scope="col">E-mail</th>
              <th scope="col">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {prefs.data.categories.map((item) => (
              <tr key={item.category}>
                <td data-label="Finalidade">{item.label}</td>
                <td data-label="E-mail">
                  <input
                    type="checkbox"
                    aria-label={`${item.label} por e-mail`}
                    checked={item.email}
                    disabled={action.pending}
                    onChange={(event) => toggle(item.category, 'EMAIL', event.target.checked)}
                  />
                </td>
                <td data-label="WhatsApp">
                  <input
                    type="checkbox"
                    aria-label={`${item.label} por WhatsApp`}
                    checked={whatsappOn && item.whatsapp}
                    disabled={!whatsappOn || action.pending}
                    onChange={(event) => toggle(item.category, 'WHATSAPP', event.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
