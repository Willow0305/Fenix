'use client';

import { useState } from 'react';

import { Alert, Empty, Loading, PageHeader, SelectField, TextField } from '../../../components/ui';
import { errorMessage } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { downloadProtectedFile } from '../../../lib/download';
import { formatDateTime, formatMoney, todayCivil } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  needsPeriod: boolean;
  groupings?: { value: string; label: string }[];
}

interface ReportColumn {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'money' | 'date' | 'datetime';
}

type Cell = string | number | null;

interface ReportTable {
  key: string;
  title: string;
  period: { from: string; to: string } | null;
  timeZone: string;
  currency: string;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  totals: Record<string, Cell> | null;
}

function render(column: ReportColumn, value: Cell): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (column.kind === 'money') {
    return formatMoney(String(value));
  }

  if (column.kind === 'datetime') {
    return formatDateTime(String(value));
  }

  if (column.kind === 'number') {
    return Number(value).toLocaleString('pt-BR');
  }

  return String(value);
}

export default function ReportsPage() {
  const { can } = useAuth();
  const catalog = useResource<ReportDefinition[]>('/reports');
  const [key, setKey] = useState('athletes');
  const [period, setPeriod] = useState({ from: `${todayCivil().slice(0, 8)}01`, to: todayCivil() });
  const [groupBy, setGroupBy] = useState('category');
  const [exportError, setExportError] = useState<string | null>(null);
  const definition = catalog.data?.find((report) => report.key === key);
  const query = {
    ...(definition?.needsPeriod ? period : {}),
    ...(definition?.groupings ? { groupBy } : {})
  };
  const report = useResource<ReportTable>(definition ? `/reports/${key}` : null, query);
  const numeric = (kind: ReportColumn['kind']) => kind === 'number' || kind === 'money';

  async function exportCsv() {
    setExportError(null);

    try {
      await downloadProtectedFile(`/reports/${key}/csv`, `fenix-${key}.csv`, query);
    } catch (caught) {
      setExportError(errorMessage(caught));
    }
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Totais derivados das movimentações e cadastros. Exportar exige permissão própria e fica registrado na auditoria."
        actions={
          can('reports.export') ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!report.data}
              onClick={() => void exportCsv()}
            >
              Exportar CSV
            </button>
          ) : undefined
        }
      />
      {exportError ? <Alert kind="error">{exportError}</Alert> : null}
      <div className="card form">
        <div className="form-grid">
          <SelectField
            label="Relatório"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            options={(catalog.data ?? []).map((r) => ({ value: r.key, label: r.title }))}
          />
          {definition?.needsPeriod ? (
            <>
              <TextField
                label="De"
                type="date"
                value={period.from}
                onChange={(e) => setPeriod({ ...period, from: e.target.value })}
              />
              <TextField
                label="Até"
                type="date"
                value={period.to}
                onChange={(e) => setPeriod({ ...period, to: e.target.value })}
              />
            </>
          ) : null}
          {definition?.groupings ? (
            <SelectField
              label="Agrupar por"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              options={definition.groupings}
            />
          ) : null}
        </div>
        {definition ? <p className="muted">{definition.description}</p> : null}
      </div>
      {report.error ? <Alert kind="error">{report.error}</Alert> : null}
      {report.loading && !report.data ? <Loading /> : null}
      {report.data ? (
        <section className="card stack" aria-labelledby="resultado">
          <h2 id="resultado" style={{ margin: 0 }}>
            {report.data.title}
          </h2>
          <small className="muted">
            {report.data.period
              ? `Período ${report.data.period.from.split('-').reverse().join('/')} a ${report.data.period.to.split('-').reverse().join('/')}`
              : 'Retrato do momento'}{' '}
            · fuso {report.data.timeZone} · {report.data.currency} · gerado em{' '}
            {formatDateTime(report.data.generatedAt)}
          </small>
          {report.data.rows.length === 0 ? (
            <Empty>Sem dados para os filtros.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {report.data.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={numeric(column.kind) ? 'num' : undefined}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.data.rows.map((row, index) => (
                    <tr key={index}>
                      {report.data?.columns.map((column) => (
                        <td key={column.key} className={numeric(column.kind) ? 'num' : undefined}>
                          {render(column, row[column.key] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {report.data.totals ? (
                  <tfoot>
                    <tr>
                      {report.data.columns.map((column, index) => (
                        <td key={column.key} className={numeric(column.kind) ? 'num' : undefined}>
                          {index === 0 ? (
                            <strong>Total</strong>
                          ) : numeric(column.kind) ? (
                            <strong>
                              {render(column, report.data?.totals?.[column.key] ?? null)}
                            </strong>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
