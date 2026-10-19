'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import {
  Alert,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  SelectField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatDate, formatMoney, todayCivil } from '../../../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../../../lib/idempotency';
import {
  type Partner,
  type PartnerSalesReport,
  type Settlement,
  SETTLEMENT_STATUS,
  type SettlementStatus
} from '../../../lib/partner-types';
import { useResource } from '../../../lib/use-resource';

function monthStart(): string {
  return `${todayCivil().slice(0, 8)}01`;
}

function SalesReport({ partnerId }: { readonly partnerId: string }) {
  const [range, setRange] = useState({ from: monthStart(), to: todayCivil() });
  const report = useResource<PartnerSalesReport>('/partners/sales-report', {
    ...range,
    partnerId
  });

  return (
    <section className="card stack" aria-labelledby="vendas">
      <h2 id="vendas">Vendas por parceiro</h2>
      <p className="muted">
        Pedidos pagos no período (fuso de Rio Branco). Receita do time = comissão; o restante é
        devido ao parceiro.
      </p>
      <div className="row">
        <TextField
          label="De"
          type="date"
          value={range.from}
          onChange={(e) => setRange({ ...range, from: e.target.value })}
        />
        <TextField
          label="Até"
          type="date"
          value={range.to}
          onChange={(e) => setRange({ ...range, to: e.target.value })}
        />
      </div>
      {report.error ? <Alert kind="error">{report.error}</Alert> : null}
      {report.data && report.data.lines.length === 0 ? (
        <Empty>Nenhuma venda de parceiro no período.</Empty>
      ) : null}
      {report.data && report.data.lines.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Parceiro</th>
                <th scope="col" className="num">
                  Itens
                </th>
                <th scope="col" className="num">
                  Vendido
                </th>
                <th scope="col" className="num">
                  Receita do time
                </th>
                <th scope="col" className="num">
                  Devido ao parceiro
                </th>
                <th scope="col" className="num">
                  Já pago
                </th>
                <th scope="col" className="num">
                  A pagar
                </th>
              </tr>
            </thead>
            <tbody>
              {report.data.lines.map((line) => (
                <tr key={line.partner.id}>
                  <td>{line.partner.name}</td>
                  <td className="num">{line.quantity}</td>
                  <td className="num">{formatMoney(line.gross.amount)}</td>
                  <td className="num">{formatMoney(line.teamRevenue.amount)}</td>
                  <td className="num">{formatMoney(line.partnerAmount.amount)}</td>
                  <td className="num">{formatMoney(line.paidOutAmount.amount)}</td>
                  <td className="num">{formatMoney(line.pendingAmount.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td />
                <td className="num">{formatMoney(report.data.totals.gross.amount)}</td>
                <td className="num">{formatMoney(report.data.totals.teamRevenue.amount)}</td>
                <td className="num">{formatMoney(report.data.totals.partnerAmount.amount)}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function SettlementsAdmin() {
  const router = useRouter();
  const params = useSearchParams();
  const [partnerId, setPartnerId] = useState(params.get('parceiro') ?? '');
  const [status, setStatus] = useState<SettlementStatus | ''>('');
  const [page, setPage] = useState(1);
  const partners = useResource<Page<Partner>>('/partners', { pageSize: 100 });
  const list = useResource<Page<Settlement>>('/settlements', {
    page,
    pageSize: 25,
    status,
    partnerId
  });
  const [form, setForm] = useState({
    periodStart: monthStart(),
    periodEnd: todayCivil(),
    dueDate: '',
    adjustmentAmount: '',
    adjustmentReason: '',
    notes: ''
  });
  const idempotency = useIdempotencyKey();
  const create = useSubmit(async () => {
    const adjustment = form.adjustmentAmount.trim();
    const negative = adjustment.startsWith('-');
    const created = await api<Settlement>(`/partners/${partnerId}/settlements`, {
      method: 'POST',
      headers: idempotency.headers(),
      body: {
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
        ...(adjustment
          ? {
              adjustmentAmount: `${negative ? '-' : ''}${normalizeAmount(adjustment.replace('-', ''))}`,
              adjustmentReason: form.adjustmentReason
            }
          : {})
      }
    });

    idempotency.rotate();
    router.push(`/admin/repasses/${created.id}`);
  });

  return (
    <>
      <PageHeader
        title="Repasses a parceiros"
        description="O repasse agrupa itens pagos e ainda não repassados. Ao pagar, uma única saída é lançada no Caixa."
      />
      <div className="card row">
        <SelectField
          label="Parceiro"
          value={partnerId}
          onChange={(e) => {
            setPage(1);
            setPartnerId(e.target.value);
          }}
          options={[
            { value: '', label: 'Todos' },
            ...(partners.data?.data ?? []).map((p) => ({ value: p.id, label: p.displayName }))
          ]}
        />
        <SelectField
          label="Situação"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as SettlementStatus | '');
          }}
          options={[
            { value: '', label: 'Todas' },
            ...Object.entries(SETTLEMENT_STATUS).map(([value, meta]) => ({
              value,
              label: meta.label
            }))
          ]}
        />
      </div>

      {partnerId ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <h2>Novo repasse</h2>
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <TextField
              label="Vendas pagas de"
              type="date"
              required
              value={form.periodStart}
              onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
            />
            <TextField
              label="até"
              type="date"
              required
              value={form.periodEnd}
              onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            />
            <TextField
              label="Vencimento"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <TextField
              label="Ajuste (R$)"
              inputMode="decimal"
              value={form.adjustmentAmount}
              onChange={(e) => setForm({ ...form, adjustmentAmount: e.target.value })}
              hint="Opcional. Use sinal de menos para descontar (ex.: -15,00)."
            />
            {form.adjustmentAmount ? (
              <TextField
                label="Motivo do ajuste"
                required
                value={form.adjustmentReason}
                onChange={(e) => setForm({ ...form, adjustmentReason: e.target.value })}
              />
            ) : null}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Gerar repasse
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">Selecione um parceiro para gerar um repasse.</p>
      )}

      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhum repasse.</Empty> : null}
      {list.data && list.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Parceiro</th>
                  <th scope="col">Período</th>
                  <th scope="col" className="num">
                    Bruto
                  </th>
                  <th scope="col" className="num">
                    Comissão
                  </th>
                  <th scope="col" className="num">
                    Líquido
                  </th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/repasses/${s.id}`}>{s.partner.name}</Link>
                    </td>
                    <td>
                      {formatDate(s.periodStart)} a {formatDate(s.periodEnd)}
                    </td>
                    <td className="num">{formatMoney(s.grossSalesAmount.amount)}</td>
                    <td className="num">{formatMoney(s.commissionAmount.amount)}</td>
                    <td className="num">{formatMoney(s.netPayableAmount.amount)}</td>
                    <td>
                      <span className={`badge ${SETTLEMENT_STATUS[s.status].badge}`}>
                        {SETTLEMENT_STATUS[s.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={list.data.meta.page}
            pageSize={list.data.meta.pageSize}
            total={list.data.meta.total}
            onChange={setPage}
          />
        </>
      ) : null}

      <SalesReport partnerId={partnerId} />
    </>
  );
}

export default function SettlementsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettlementsAdmin />
    </Suspense>
  );
}
