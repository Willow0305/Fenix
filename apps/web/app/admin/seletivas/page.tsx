'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TryoutForm } from '../../../components/tryout-form';
import { Alert, Empty, Loading, PageHeader } from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { formatDateTime } from '../../../lib/format';
import { type Team, TRYOUT_STATUS, type Tryout } from '../../../lib/sports-types';
import { useResource } from '../../../lib/use-resource';
import { Icon } from '../../../components/icon';

export default function TryoutsAdminPage() {
  const { can } = useAuth();
  const router = useRouter();
  const tryouts = useResource<Tryout[]>('/tryouts');
  const teams = useResource<Team[]>('/teams');
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Seletivas"
        description="Agenda, período de inscrição, vagas e análise das inscrições."
        actions={
          can('tryouts.manage') ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating((v) => !v)}
            >
              {creating ? (
                'Fechar'
              ) : (
                <>
                  <Icon name="plus-lg" /> Nova seletiva
                </>
              )}
            </button>
          ) : null
        }
      />
      {creating ? (
        <section className="card">
          <TryoutForm
            teams={teams.data ?? []}
            submitLabel="Criar seletiva (rascunho)"
            onSubmit={async (payload) => {
              const created = await api<Tryout>('/tryouts', { method: 'POST', body: payload });

              router.push(`/admin/seletivas/${created.id}`);
            }}
          />
        </section>
      ) : null}
      {tryouts.error ? <Alert kind="error">{tryouts.error}</Alert> : null}
      {tryouts.loading && !tryouts.data ? <Loading /> : null}
      {tryouts.data?.length === 0 ? <Empty>Nenhuma seletiva criada.</Empty> : null}
      {tryouts.data && tryouts.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Seletiva</th>
                <th scope="col">Data</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  Inscrições
                </th>
              </tr>
            </thead>
            <tbody>
              {tryouts.data.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/seletivas/${t.id}`}>{t.title}</Link>
                    {t.team ? <span className="muted"> · {t.team.name}</span> : null}
                  </td>
                  <td>{formatDateTime(t.startsAt)}</td>
                  <td>
                    <span className={`badge ${TRYOUT_STATUS[t.status].badge}`}>
                      {TRYOUT_STATUS[t.status].label}
                    </span>
                  </td>
                  <td className="num">
                    {t.usedSlots}
                    {t.maxSlots ? ` / ${t.maxSlots}` : ''}
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
