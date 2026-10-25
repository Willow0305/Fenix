'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

import { AthleteForm } from '../../../components/athlete-form';
import { Icon } from '../../../components/icon';
import {
  Alert,
  ClearFilters,
  ConfirmDialog,
  Empty,
  PageHeader,
  Pagination,
  Skeleton
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDate, formatDateTime, formatPhoneDisplay } from '../../../lib/format';
import {
  type AthleteDetail,
  INTERESTED_NEXT,
  INTERESTED_STATUS,
  type Interested,
  type InterestedStatus
} from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';
import { useUrlFilters } from '../../../lib/use-url-filters';

const DEFAULTS = { busca: '', status: '' };

function InterestedList() {
  const { can } = useAuth();
  const filters = useUrlFilters(DEFAULTS);
  const { busca, status } = filters.values;
  const [search, setSearch] = useState(busca);
  const list = useResource<Page<Interested>>('/interested-people', {
    page: filters.page,
    pageSize: 20,
    status,
    search: busca
  });

  useEffect(() => setSearch(busca), [busca]);
  const [change, setChange] = useState<{ person: Interested; status: InterestedStatus } | null>(
    null
  );
  const [converting, setConverting] = useState<Interested | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Interessados"
        description="Pessoas que deixaram contato pelo site. Envio não cria conta nem atleta."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <form
        className="row filter-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          filters.set({ busca: search.trim() });
        }}
      >
        <label className="field">
          <span className="label">Buscar</span>
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, e-mail ou telefone"
          />
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select
            value={status}
            onChange={(e) => filters.set({ status: e.target.value as InterestedStatus | '' })}
          >
            <option value="">Todos</option>
            {Object.entries(INTERESTED_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary">
            <Icon name="search" /> Buscar
          </button>
          <ClearFilters active={filters.active} onClear={filters.clear} />
        </div>
      </form>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Skeleton lines={4} /> : null}
      {list.data?.data.length === 0 ? (
        <Empty>
          {filters.active > 0 ? 'Nenhum interessado para os filtros.' : 'Nenhum interessado ainda.'}
        </Empty>
      ) : null}
      {list.data?.data.map((person) => (
        <article key={person.id} className="card stack" style={{ gap: '0.5rem' }}>
          <div className="row">
            <strong>{person.fullName}</strong>
            <span className={`badge ${INTERESTED_STATUS[person.status].badge}`}>
              {INTERESTED_STATUS[person.status].label}
            </span>
            <span className="spacer" />
            <small className="muted">{formatDateTime(person.createdAt)}</small>
          </div>
          <span className="muted">
            Nascimento {formatDate(person.birthDate)} · {person.email} ·{' '}
            {formatPhoneDisplay(person.phone)}
            {person.desiredPosition ? ` · ${person.desiredPosition}` : ''}
          </span>
          {person.guardianName ? (
            <span className="muted">
              Responsável: {person.guardianName} ({formatPhoneDisplay(person.guardianPhone)})
            </span>
          ) : null}
          {person.notes ? (
            <p className="prose" style={{ margin: 0 }}>
              {person.notes}
            </p>
          ) : null}
          <div className="row">
            {can('registrations.review')
              ? INTERESTED_NEXT[person.status].map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setChange({ person, status: next })}
                  >
                    {INTERESTED_STATUS[next].label}
                  </button>
                ))
              : null}
            {person.status !== 'CONVERTED' && can('registrations.review', 'athletes.create') ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setConverting(person)}
              >
                <Icon name="person-plus" /> Converter em atleta
              </button>
            ) : null}
            {person.convertedAthleteId ? (
              <Link href={`/admin/atletas/${person.convertedAthleteId}`}>Ver atleta</Link>
            ) : null}
          </div>
          {converting?.id === person.id ? (
            <div className="card stack">
              <h3>Conversão em atleta</h3>
              <p className="muted">
                Revise e complete os dados. A conversão fica registrada na auditoria.
              </p>
              <AthleteForm
                mode="create"
                source={{
                  fullName: person.fullName,
                  birthDate: person.birthDate,
                  email: person.email,
                  phone: person.phone,
                  guardianName: person.guardianName,
                  guardianPhone: person.guardianPhone,
                  desiredPosition: person.desiredPosition
                }}
                submitLabel="Criar atleta"
                onSubmit={async (payload) => {
                  const created = await api<AthleteDetail>(
                    `/interested-people/${person.id}/convert`,
                    { method: 'POST', body: payload }
                  );

                  setConverting(null);
                  setNotice(`Atleta ${created.fullName} criado.`);
                  await list.reload();
                }}
              />
              <button type="button" className="btn btn-link" onClick={() => setConverting(null)}>
                Cancelar
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {list.data ? <Pagination {...list.data.meta} onChange={filters.setPage} /> : null}
      <ConfirmDialog
        open={change !== null}
        title={`Marcar como "${change ? INTERESTED_STATUS[change.status].label : ''}"`}
        confirmLabel="Confirmar"
        onClose={() => setChange(null)}
        onConfirm={async () => {
          await api(`/interested-people/${change?.person.id ?? ''}/status`, {
            method: 'PUT',
            body: { status: change?.status }
          });
          await list.reload();
        }}
      />
    </>
  );
}

export default function InterestedPage() {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <InterestedList />
    </Suspense>
  );
}
