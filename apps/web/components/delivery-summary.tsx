'use client';

import { formatDateTime } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Icon } from './icon';

interface DeliverySummary {
  readonly email: 'smtp' | 'teste';
  readonly whatsapp: 'cloud' | 'teste' | 'desligado';
  readonly whatsappConsents: number;
  readonly lastWeek: readonly { channel: string; status: string; count: number }[];
  readonly recentFailures: readonly {
    channel: string;
    code: string | null;
    type: string;
    at: string;
  }[];
}

const MODE: Record<string, string> = {
  smtp: 'enviando',
  cloud: 'enviando',
  teste: 'modo de teste (nada é enviado)',
  desligado: 'desligado'
};

const CHANNEL: Record<string, string> = { EMAIL: 'E-mail', WHATSAPP: 'WhatsApp' };

function count(summary: DeliverySummary, channel: string, statuses: readonly string[]): number {
  return summary.lastWeek
    .filter((row) => row.channel === channel && statuses.includes(row.status))
    .reduce((total, row) => total + row.count, 0);
}

/** Situação dos canais externos e dos envios dos últimos 7 dias (DT-048), sem destinatários. */
export function DeliverySummaryCard() {
  const summary = useResource<DeliverySummary>('/notifications/deliveries/summary');
  const data = summary.data;

  if (!data) {
    return null;
  }

  return (
    <section className="card stack" aria-labelledby="canais">
      <h2 id="canais">
        <Icon name="send" className="icon-lead" /> E-mail e WhatsApp
      </h2>
      <p className="muted m-0">
        Cada pessoa escolhe em Minha conta quais avisos recebe por e-mail e WhatsApp; o WhatsApp só
        vale depois do aceite dela ({data.whatsappConsents} pessoa(s) aceitaram).
      </p>
      <div className="table-wrap">
        <table className="table table-stack">
          <thead>
            <tr>
              <th scope="col">Canal</th>
              <th scope="col">Situação</th>
              <th scope="col" className="num">
                Enviados (7 dias)
              </th>
              <th scope="col" className="num">
                Na fila
              </th>
              <th scope="col" className="num">
                Falharam
              </th>
            </tr>
          </thead>
          <tbody>
            {(['EMAIL', 'WHATSAPP'] as const).map((channel) => (
              <tr key={channel}>
                <td data-label="Canal">{CHANNEL[channel]}</td>
                <td data-label="Situação">
                  {MODE[channel === 'EMAIL' ? data.email : data.whatsapp]}
                </td>
                <td data-label="Enviados (7 dias)" className="num">
                  {count(data, channel, ['SENT'])}
                </td>
                <td data-label="Na fila" className="num">
                  {count(data, channel, ['PENDING', 'SENDING'])}
                </td>
                <td data-label="Falharam" className="num">
                  {count(data, channel, ['FAILED'])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.recentFailures.length > 0 ? (
        <details>
          <summary>Falhas recentes</summary>
          <ul>
            {data.recentFailures.map((failure, index) => (
              <li key={`${failure.at}-${index}`}>
                {formatDateTime(failure.at)} · {CHANNEL[failure.channel] ?? failure.channel} ·{' '}
                {failure.type} · <code>{failure.code ?? 'sem código'}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
