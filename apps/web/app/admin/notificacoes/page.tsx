'use client';

import { useState } from 'react';

import { DeliverySummaryCard } from '../../../components/delivery-summary';
import {
  Alert,
  Empty,
  ErrorSummary,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit,
  Pagination
} from '../../../components/ui';
import type { Page } from '../../../lib/api-types';
import { api } from '../../../lib/api-client';
import type { BroadcastHistoryItem } from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { useIdempotencyKey } from '../../../lib/idempotency';
import { useResource } from '../../../lib/use-resource';
import { teamOptions } from '../../../lib/team-options';

const AUDIENCES = [
  { value: 'ACTIVE_ATHLETES', label: 'Atletas ativos com conta' },
  { value: 'TEAM', label: 'Atletas de uma equipe' },
  { value: 'STAFF', label: 'Diretoria' },
  { value: 'ALL_USERS', label: 'Todos os usuários ativos' }
];

export default function BroadcastPage() {
  const teams = useResource<{ id: string; name: string; isActive: boolean }[]>('/teams');
  const [historyPage, setHistoryPage] = useState(1);
  const history = useResource<Page<BroadcastHistoryItem>>('/notifications/broadcasts', {
    page: historyPage,
    pageSize: 20
  });
  const [form, setForm] = useState({
    audience: 'ACTIVE_ATHLETES',
    teamId: '',
    title: '',
    message: '',
    link: ''
  });
  const [notice, setNotice] = useState<string | null>(null);
  const idempotency = useIdempotencyKey();
  const send = useSubmit(async () => {
    const result = await api<{ recipients: number; delivered: number; replayed: boolean }>(
      '/notifications/broadcast',
      {
        method: 'POST',
        headers: idempotency.headers(),
        body: {
          audience: form.audience,
          title: form.title,
          message: form.message,
          ...(form.audience === 'TEAM' ? { teamId: form.teamId } : {}),
          ...(form.link ? { link: form.link } : {})
        }
      }
    );

    idempotency.rotate();
    setNotice(
      result.replayed
        ? 'Este aviso já tinha sido enviado; ninguém foi notificado de novo.'
        : `Aviso enviado a ${result.recipients} pessoa(s).`
    );
    setForm({ ...form, title: '', message: '', link: '' });
    await history.reload();
  });

  return (
    <>
      <PageHeader
        title="Avisos"
        description="Aviso para um grupo: aparece em Notificações e sai por e-mail e WhatsApp para quem escolheu esses canais. Cada envio é registrado na auditoria."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <form className="form card" onSubmit={(event) => void send.submit(event)}>
        <ErrorSummary error={send.error} />
        <div className="form-grid">
          <SelectField
            label="Para quem"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            options={AUDIENCES}
          />
          {form.audience === 'TEAM' ? (
            <SelectField
              label="Equipe"
              required
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              options={[
                { value: '', label: 'Selecione' },
                ...teamOptions(teams.data ?? [], 'pick')
              ]}
            />
          ) : null}
          <TextField
            label="Título"
            required
            maxLength={180}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Link interno (opcional)"
            maxLength={300}
            value={form.link}
            placeholder="/eventos"
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            hint="Somente páginas do próprio site."
          />
        </div>
        <TextArea
          label="Mensagem"
          required
          maxLength={2000}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          hint="Não inclua dados pessoais de outras pessoas."
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={send.pending}>
            Enviar aviso
          </button>
        </div>
      </form>
      <DeliverySummaryCard />
      <section className="card stack" aria-labelledby="enviados">
        <h2 id="enviados">Enviados recentemente</h2>
        {history.data?.data.length === 0 ? <Empty>Nenhum aviso enviado.</Empty> : null}
        {history.data && history.data.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Título</th>
                  <th scope="col">Grupo</th>
                  <th scope="col" className="num">
                    Pessoas
                  </th>
                  <th scope="col">Por</th>
                </tr>
              </thead>
              <tbody>
                {history.data.data.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Quando">{formatDateTime(item.occurredAt)}</td>
                    <td data-label="Título">{item.title}</td>
                    <td data-label="Grupo">{item.audience}</td>
                    <td data-label="Pessoas" className="num">
                      {item.recipients}
                    </td>
                    <td data-label="Por">{item.actor ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {history.data ? <Pagination {...history.data.meta} onChange={setHistoryPage} /> : null}
      </section>
    </>
  );
}
