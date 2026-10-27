'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  PageHeader,
  Pagination,
  SelectField,
  Skeleton
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { RETURN_RESOLUTION, RETURN_STATUS, type ReturnView } from '../../../lib/store-types';
import { useResource } from '../../../lib/use-resource';

type Decision = { item: ReturnView; reject: boolean };

/**
 * Desistências e defeitos (DT-070). Desistência dentro do prazo não pode ser negada: a
 * diretoria registra a devolução do item e faz o estorno integral pelo Caixa.
 */
export default function ReturnsAdminPage() {
  const { can } = useAuth();
  const [scope, setScope] = useState<'open' | 'closed'>('open');
  const [page, setPage] = useState(1);
  const list = useResource<Page<ReturnView>>('/store/returns', {
    status: scope,
    page,
    pageSize: 20
  });
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const [resolution, setResolution] = useState<'REFUND' | 'EXCHANGE' | 'REPAIR'>('EXCHANGE');
  const [notice, setNotice] = useState<string | null>(null);
  const manage = can('refunds.create');

  return (
    <>
      <PageHeader
        title="Trocas e devoluções"
        description="Desistência em até 7 dias da entrega (exceto personalizados) e defeito em até 90 dias."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <div className="row" role="group" aria-label="Situação">
        {(
          [
            ['open', 'Aguardando'],
            ['closed', 'Atendidos']
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${scope === value ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={scope === value}
            onClick={() => {
              setScope(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Skeleton lines={4} /> : null}
      {list.data?.data.length === 0 ? <Empty>Nada por aqui.</Empty> : null}
      {list.data?.data.map((r) => (
        <article key={r.id} className="card stack" style={{ gap: '0.4rem' }}>
          <div className="row">
            <strong>{r.kind === 'WITHDRAWAL' ? 'Desistência' : 'Defeito'}</strong>
            <Link href={`/admin/pedidos/${r.orderId}`}>{r.orderNumber}</Link>
            <span className="muted">{r.customerName}</span>
            <span className="muted">{formatDateTime(r.createdAt)}</span>
            <span className="spacer" />
            <span className={`badge ${RETURN_STATUS[r.status].badge}`}>
              {RETURN_STATUS[r.status].label}
            </span>
          </div>
          <div>{r.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</div>
          {r.description ? <div className="muted">&ldquo;{r.description}&rdquo;</div> : null}
          {r.response ? (
            <div>
              Resposta{r.resolution ? ` (${RETURN_RESOLUTION[r.resolution]})` : ''}: {r.response}
              {r.refundAmount ? ` · estorno de ${formatMoney(r.refundAmount.amount)}` : ''}
            </div>
          ) : null}
          {manage && (r.status === 'OPEN' || r.status === 'AWAITING_ITEM') ? (
            <div className="row">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setDeciding({ item: r, reject: false })}
              >
                {r.kind === 'WITHDRAWAL' ? 'Registrar devolução e estornar' : 'Resolver'}
              </button>
              {r.kind === 'DEFECT' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDeciding({ item: r, reject: true })}
                >
                  Recusar
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
      {list.data ? <Pagination {...list.data.meta} onChange={setPage} /> : null}

      <ConfirmDialog
        open={deciding !== null}
        title={
          deciding?.reject
            ? 'Recusar o defeito'
            : deciding?.item.kind === 'WITHDRAWAL'
              ? 'Registrar devolução e estornar'
              : 'Resolver o defeito'
        }
        description={
          deciding?.item.kind === 'WITHDRAWAL'
            ? 'O estorno integral dos itens sai pelo Caixa, vinculado ao pagamento. Itens de estoque voltam ao estoque; afiliação é cancelada.'
            : deciding?.reject
              ? 'Explique ao cliente o motivo da recusa (fica registrado).'
              : 'Escolha a solução e escreva a resposta ao cliente.'
        }
        confirmLabel={deciding?.reject ? 'Recusar' : 'Confirmar'}
        danger={deciding?.reject ?? false}
        requireReason
        onClose={() => setDeciding(null)}
        onConfirm={async (response) => {
          if (!deciding) {
            return;
          }

          await api(`/store/returns/${deciding.item.id}/decide`, {
            method: 'POST',
            body: {
              response,
              ...(deciding.reject ? { reject: true } : {}),
              ...(deciding.item.kind === 'DEFECT' && !deciding.reject ? { resolution } : {})
            }
          });
          setNotice('Resposta registrada e enviada ao cliente.');
          await list.reload();
        }}
      >
        {deciding && deciding.item.kind === 'DEFECT' && !deciding.reject ? (
          <SelectField
            label="Solução"
            value={resolution}
            onChange={(e) => setResolution(e.target.value as 'REFUND' | 'EXCHANGE' | 'REPAIR')}
            options={Object.entries(RETURN_RESOLUTION).map(([value, label]) => ({ value, label }))}
          />
        ) : null}
      </ConfirmDialog>
    </>
  );
}
