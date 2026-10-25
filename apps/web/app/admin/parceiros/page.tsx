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
  Pagination,
  SelectField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatDate } from '../../../lib/format';
import {
  commissionLabel,
  type Partner,
  PARTNER_STATUS,
  PARTNER_TYPE,
  type PartnerStatus,
  type PartnerType
} from '../../../lib/partner-types';
import { useResource } from '../../../lib/use-resource';

export default function PartnersAdminPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PartnerStatus | ''>('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const partners = useResource<Page<Partner>>('/partners', {
    page,
    pageSize: 25,
    status,
    search: term
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    legalName: '',
    displayName: '',
    type: 'STORE' as PartnerType
  });
  const create = useSubmit(async () => {
    const created = await api<Partner>('/partners', { method: 'POST', body: form });

    router.push(`/admin/parceiros/${created.id}`);
  });

  return (
    <>
      <PageHeader
        title="Parceiros"
        description="Somente parceiros aprovados e dentro da vigência do contrato aparecem no site e vendem na loja."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Fechar' : 'Novo parceiro'}
          </button>
        }
      />
      {creating ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <ErrorSummary error={create.error} />
          <p className="muted">
            O cadastro começa “Em análise”. Contrato, comissão e documentos são preenchidos na
            ficha.
          </p>
          <div className="form-grid">
            <TextField
              label="Razão social / nome completo"
              maxLength={180}
              required
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
            <TextField
              label="Nome de exibição"
              maxLength={160}
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
            <SelectField
              label="Tipo"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as PartnerType })}
              options={Object.entries(PARTNER_TYPE).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Cadastrar
            </button>
          </div>
        </form>
      ) : null}
      <form
        className="row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setTerm(search);
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome"
          />
        </label>
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as PartnerStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(PARTNER_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>
      {partners.error ? <Alert kind="error">{partners.error}</Alert> : null}
      {partners.loading && !partners.data ? <Loading /> : null}
      {partners.data?.data.length === 0 ? <Empty>Nenhum parceiro encontrado.</Empty> : null}
      {partners.data && partners.data.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Parceiro</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Vigência</th>
                  <th scope="col">Comissão</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {partners.data.data.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Parceiro">
                      <Link href={`/admin/parceiros/${p.id}`}>{p.displayName}</Link>
                    </td>
                    <td data-label="Tipo">{PARTNER_TYPE[p.type]}</td>
                    <td data-label="Vigência">
                      {p.contractStartsOn ? formatDate(p.contractStartsOn) : '—'}
                      {p.contractEndsOn ? ` a ${formatDate(p.contractEndsOn)}` : ''}
                    </td>
                    <td data-label="Comissão">
                      {commissionLabel(
                        p.commissionType,
                        p.commissionPercentage,
                        p.commissionFixedAmount
                      )}
                    </td>
                    <td data-label="Situação">
                      <span className={`badge ${PARTNER_STATUS[p.status].badge}`}>
                        {PARTNER_STATUS[p.status].label}
                      </span>
                      {p.status === 'ACTIVE' && !p.operational ? (
                        <span className="badge badge-warning">fora da vigência</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={partners.data.meta.page}
            pageSize={partners.data.meta.pageSize}
            total={partners.data.meta.total}
            onChange={setPage}
          />
        </>
      ) : null}
    </>
  );
}
