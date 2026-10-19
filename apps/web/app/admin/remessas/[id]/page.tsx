'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import {
  CAMPAIGN_NEXT,
  CAMPAIGN_STATUS,
  type Campaign,
  type CampaignReport,
  type CampaignStatus
} from '../../../../lib/campaign-types';
import { downloadProtectedFile } from '../../../../lib/download';
import { formatDate, formatDateTime, formatMoney, todayCivil } from '../../../../lib/format';
import { normalizeAmount } from '../../../../lib/idempotency';
import type { Page } from '../../../../lib/api-types';
import { ORDER_STATUS, type ProductDetail } from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';

const NEEDS_DATE: CampaignStatus[] = ['ORDERED', 'IN_PRODUCTION', 'RECEIVED'];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const campaign = useResource<Campaign>(`/campaigns/${id}`);
  const report = useResource<CampaignReport>(`/campaigns/${id}/report`);
  const products = useResource<Page<ProductDetail>>('/store/products', { pageSize: 100 });
  const [notice, setNotice] = useState<string | null>(null);
  const [next, setNext] = useState<CampaignStatus | null>(null);
  const [step, setStep] = useState({
    date: todayCivil(),
    salesEndAt: '',
    pickupStartsOn: todayCivil(),
    pickupEndsOn: '',
    pickupInstructions: ''
  });
  const [link, setLink] = useState({ productId: '', campaignPrice: '', maximumQuantity: '' });
  const attach = useSubmit(async () => {
    campaign.setData(
      await api<Campaign>(`/campaigns/${id}/products`, {
        method: 'PUT',
        body: {
          productId: link.productId,
          ...(link.campaignPrice ? { campaignPrice: normalizeAmount(link.campaignPrice) } : {}),
          ...(link.maximumQuantity ? { maximumQuantity: Number(link.maximumQuantity) } : {})
        }
      })
    );
    setLink({ productId: '', campaignPrice: '', maximumQuantity: '' });
  });

  async function pickup(orderNumber: string) {
    const order = await api<{ data: { id: string }[] }>('/store/orders', {
      query: { search: orderNumber, pageSize: 1 }
    });
    const orderId = order.data[0]?.id;

    if (orderId) {
      report.setData(
        await api<CampaignReport>(`/campaigns/${id}/orders/${orderId}/pickup`, {
          method: 'POST',
          body: {}
        })
      );
      setNotice(`Retirada do pedido ${orderNumber} registrada.`);
    }
  }

  if (!campaign.data) {
    return campaign.error ? <Alert kind="error">{campaign.error}</Alert> : <Loading />;
  }

  const c = campaign.data;
  const editable = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED'].includes(c.status);
  const candidates = (products.data?.data ?? []).filter(
    (p) =>
      p.fulfillmentType === 'CAMPAIGN' &&
      p.status !== 'ARCHIVED' &&
      !c.products.some((cp) => cp.productId === p.id)
  );

  return (
    <>
      <PageHeader
        title={c.name}
        description={`Vendas de ${formatDateTime(c.salesStartAt)} a ${formatDateTime(c.salesEndAt)}`}
        actions={<Link href="/admin/remessas">Voltar</Link>}
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {c.cancellationReason ? (
        <Alert kind="warning">Cancelada: {c.cancellationReason}</Alert>
      ) : null}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Situação</div>
          <span className={`badge ${CAMPAIGN_STATUS[c.status].badge}`}>
            {CAMPAIGN_STATUS[c.status].label}
          </span>
        </div>
        <div className="stat">
          <div className="stat-label">Unidades pagas</div>
          <div className="stat-value">
            {c.paidQuantity}
            {c.minimumQuantity ? (
              <small className="muted"> / mín. {c.minimumQuantity}</small>
            ) : null}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Aguardando pagamento</div>
          <div className="stat-value">{c.reservedQuantity}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Etapas</div>
          <small>
            Encomenda: {formatDate(c.supplierOrderedOn)} · Produção:{' '}
            {formatDate(c.expectedProductionOn)} · Recebida: {formatDate(c.receivedOn)}
            <br />
            Retirada: {formatDate(c.pickupStartsOn)}
            {c.pickupEndsOn ? ` a ${formatDate(c.pickupEndsOn)}` : ''}
          </small>
        </div>
      </div>

      {CAMPAIGN_NEXT[c.status].length > 0 ? (
        <section className="card row">
          <strong>Próxima etapa:</strong>
          {CAMPAIGN_NEXT[c.status].map((status) => (
            <button
              key={status}
              type="button"
              className={`btn btn-sm ${status === 'CANCELLED' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setNext(status)}
            >
              {status === 'OPEN' && c.status === 'CLOSED'
                ? 'Reabrir vendas'
                : CAMPAIGN_STATUS[status].label}
            </button>
          ))}
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="produtos">
        <h2 id="produtos">Produtos da remessa</h2>
        {c.products.length === 0 ? (
          <p className="muted">Vincule produtos com modo de venda “Remessa”.</p>
        ) : null}
        <ul>
          {c.products.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/produtos/${p.productId}`}>{p.productName}</Link> —{' '}
              {p.campaignPrice ? formatMoney(p.campaignPrice.amount) : 'preço do produto'} ·{' '}
              {p.soldQuantity} vendida(s)
              {p.maximumQuantity ? ` / máx. ${p.maximumQuantity}` : ''}
            </li>
          ))}
        </ul>
        {editable ? (
          <form className="row" onSubmit={(event) => void attach.submit(event)}>
            <SelectField
              label="Produto"
              value={link.productId}
              onChange={(e) => setLink({ ...link, productId: e.target.value })}
              options={[
                { value: '', label: 'Selecione' },
                ...candidates.map((p) => ({ value: p.id, label: p.name }))
              ]}
            />
            <TextField
              label="Preço na remessa"
              inputMode="decimal"
              value={link.campaignPrice}
              onChange={(e) => setLink({ ...link, campaignPrice: e.target.value })}
            />
            <TextField
              label="Máximo do produto"
              type="number"
              min={1}
              value={link.maximumQuantity}
              onChange={(e) => setLink({ ...link, maximumQuantity: e.target.value })}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={!link.productId || attach.pending}
            >
              Vincular
            </button>
            <ErrorSummary error={attach.error} />
          </form>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="consolidado">
        <div className="row">
          <h2 id="consolidado" style={{ margin: 0 }}>
            Consolidado (pedidos pagos)
          </h2>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              void downloadProtectedFile(`/campaigns/${id}/report.csv`, `${c.slug}-malharia.csv`, {
                kind: 'supplier'
              })
            }
          >
            CSV para malharia
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              void downloadProtectedFile(`/campaigns/${id}/report.csv`, `${c.slug}-retirada.csv`, {
                kind: 'pickup'
              })
            }
          >
            Lista de retirada
          </button>
        </div>
        {report.data ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Variação</th>
                    <th scope="col">SKU</th>
                    <th scope="col" className="num">
                      Quantidade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.lines.map((line) => (
                    <tr key={line.sku}>
                      <td>{line.productName}</td>
                      <td>{line.variantName}</td>
                      <td>
                        <code>{line.sku}</code>
                      </td>
                      <td className="num">{line.quantity}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={3} className="num">
                      Total
                    </th>
                    <td className="num">{report.data.totalQuantity}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <h3>Pedidos e retirada</h3>
            <ul>
              {report.data.orders.map((o) => (
                <li key={o.orderNumber} className="row">
                  <strong>{o.orderNumber}</strong> {o.customerName}{' '}
                  {o.customerPhone ? `· ${o.customerPhone}` : ''} — {o.items}{' '}
                  <span className={`badge ${ORDER_STATUS[o.status].badge}`}>
                    {ORDER_STATUS[o.status].label}
                  </span>
                  {o.status === 'READY_FOR_PICKUP' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void pickup(o.orderNumber)}
                    >
                      Registrar retirada
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Loading />
        )}
      </section>

      <ConfirmDialog
        open={next !== null}
        title={`Remessa: ${next ? CAMPAIGN_STATUS[next].label : ''}`}
        description={
          next === 'ORDERED'
            ? 'Pedidos sem pagamento serão cancelados e o consolidado fica fixo para a malharia.'
            : next === 'CANCELLED'
              ? 'Todos os pedidos serão cancelados e os pagamentos estornados com saída vinculada no Caixa.'
              : next === 'READY_FOR_PICKUP'
                ? 'Os compradores com pedido pago serão avisados (uma única vez) com local e prazo.'
                : undefined
        }
        confirmLabel="Confirmar"
        danger={next === 'CANCELLED'}
        requireReason={next === 'CANCELLED'}
        onClose={() => setNext(null)}
        onConfirm={async (reason) => {
          campaign.setData(
            await api<Campaign>(`/campaigns/${id}/status`, {
              method: 'PUT',
              body: {
                status: next,
                ...(reason ? { reason } : {}),
                ...(next && NEEDS_DATE.includes(next) ? { date: step.date } : {}),
                ...(next === 'OPEN' && step.salesEndAt
                  ? { salesEndAt: new Date(step.salesEndAt).toISOString() }
                  : {}),
                ...(next === 'READY_FOR_PICKUP'
                  ? {
                      pickupStartsOn: step.pickupStartsOn,
                      ...(step.pickupEndsOn ? { pickupEndsOn: step.pickupEndsOn } : {}),
                      ...(step.pickupInstructions
                        ? { pickupInstructions: step.pickupInstructions }
                        : {})
                    }
                  : {})
              }
            })
          );
          await report.reload();
          setNotice('Etapa atualizada.');
        }}
      >
        {next && NEEDS_DATE.includes(next) ? (
          <TextField
            label="Data"
            type="date"
            value={step.date}
            onChange={(e) => setStep({ ...step, date: e.target.value })}
          />
        ) : null}
        {next === 'OPEN' ? (
          <TextField
            label="Novo encerramento (se o prazo já passou)"
            type="datetime-local"
            value={step.salesEndAt}
            onChange={(e) => setStep({ ...step, salesEndAt: e.target.value })}
          />
        ) : null}
        {next === 'READY_FOR_PICKUP' ? (
          <>
            <TextField
              label="Retirada a partir de"
              type="date"
              value={step.pickupStartsOn}
              onChange={(e) => setStep({ ...step, pickupStartsOn: e.target.value })}
            />
            <TextField
              label="Retirada até"
              type="date"
              value={step.pickupEndsOn}
              onChange={(e) => setStep({ ...step, pickupEndsOn: e.target.value })}
            />
            <TextArea
              label="Local e horário"
              value={step.pickupInstructions}
              onChange={(e) => setStep({ ...step, pickupInstructions: e.target.value })}
            />
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
