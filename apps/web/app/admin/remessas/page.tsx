'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { CAMPAIGN_STATUS, type Campaign } from '../../../lib/campaign-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

function localInput(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function CampaignsPage() {
  const router = useRouter();
  const campaigns = useResource<Campaign[]>('/campaigns');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    salesStartAt: localInput(0),
    salesEndAt: localInput(15),
    minimumQuantity: '',
    maximumQuantity: '',
    refundPolicy: ''
  });
  const create = useSubmit(async () => {
    const created = await api<Campaign>('/campaigns', {
      method: 'POST',
      body: {
        name: form.name,
        salesStartAt: new Date(form.salesStartAt).toISOString(),
        salesEndAt: new Date(form.salesEndAt).toISOString(),
        ...(form.description ? { description: form.description } : {}),
        ...(form.minimumQuantity ? { minimumQuantity: Number(form.minimumQuantity) } : {}),
        ...(form.maximumQuantity ? { maximumQuantity: Number(form.maximumQuantity) } : {}),
        ...(form.refundPolicy ? { refundPolicy: form.refundPolicy } : {})
      }
    });

    router.push(`/admin/remessas/${created.id}`);
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <>
      <PageHeader
        title="Remessas"
        description="Pré-vendas por período (uniformes) encomendadas ao fornecedor após o encerramento."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Fechar' : 'Nova remessa'}
          </button>
        }
      />
      {creating ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <TextField
              label="Nome"
              maxLength={160}
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Uniformes temporada 2027"
            />
            <TextField
              label="Início das vendas"
              type="datetime-local"
              required
              value={form.salesStartAt}
              onChange={set('salesStartAt')}
            />
            <TextField
              label="Encerramento das vendas"
              type="datetime-local"
              required
              value={form.salesEndAt}
              onChange={set('salesEndAt')}
            />
            <TextField
              label="Mínimo de unidades pagas"
              type="number"
              min={1}
              value={form.minimumQuantity}
              onChange={set('minimumQuantity')}
            />
            <TextField
              label="Máximo de unidades"
              type="number"
              min={1}
              value={form.maximumQuantity}
              onChange={set('maximumQuantity')}
            />
          </div>
          <TextArea
            label="Descrição pública"
            maxLength={8000}
            value={form.description}
            onChange={set('description')}
          />
          <TextArea
            label="Política se o mínimo não for atingido"
            maxLength={4000}
            value={form.refundPolicy}
            onChange={set('refundPolicy')}
            hint="Exibida antes da compra (PEN-032). Ex.: valores pagos são devolvidos integralmente por PIX em até 7 dias."
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Criar remessa
            </button>
          </div>
        </form>
      ) : null}
      {campaigns.error ? <Alert kind="error">{campaigns.error}</Alert> : null}
      {campaigns.loading && !campaigns.data ? <Loading /> : null}
      {campaigns.data?.length === 0 ? <Empty>Nenhuma remessa criada.</Empty> : null}
      {campaigns.data && campaigns.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Remessa</th>
                <th scope="col">Vendas até</th>
                <th scope="col" className="num">
                  Pagas / mínimo
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/remessas/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{formatDateTime(c.salesEndAt)}</td>
                  <td className="num">
                    {c.paidQuantity}
                    {c.minimumQuantity ? ` / ${c.minimumQuantity}` : ''}
                    {c.reservedQuantity ? (
                      <span className="muted"> (+{c.reservedQuantity} aguardando)</span>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge ${CAMPAIGN_STATUS[c.status].badge}`}>
                      {CAMPAIGN_STATUS[c.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
