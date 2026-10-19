'use client';

import { useRouter } from 'next/navigation';

import { AthleteForm } from '../../../../components/athlete-form';
import { PageHeader } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { AthleteDetail } from '../../../../lib/sports-types';

export default function NewAthletePage() {
  const router = useRouter();

  return (
    <>
      <PageHeader title="Novo atleta" description="O atleta começa com status Pendente." />
      <div className="card">
        <AthleteForm
          mode="create"
          submitLabel="Cadastrar atleta"
          onSubmit={async (payload) => {
            const created = await api<AthleteDetail>('/athletes', {
              method: 'POST',
              body: payload
            });

            router.push(`/admin/atletas/${created.id}`);
          }}
        />
      </div>
    </>
  );
}
