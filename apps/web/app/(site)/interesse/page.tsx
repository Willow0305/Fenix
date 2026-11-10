'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ApplicantForm } from '../../../components/applicant-form';
import { Alert, Skeleton } from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { PublicTeam } from '../../../lib/api-types';
import { useResource } from '../../../lib/use-resource';

export default function InterestPage() {
  const [done, setDone] = useState(false);
  const team = useResource<PublicTeam>('/public/team');
  // Elenco lotado (DT-107): a diretoria fechou os contatos; o servidor também recusa.
  const closed = team.data?.interestIntakeOpen === false;

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem', maxWidth: 860 }}>
      <h1>Quero jogar no Fênix</h1>
      {closed ? null : (
        <p className="muted">
          Deixe seu contato e a diretoria falará com você sobre treinos e próximas seletivas. O
          envio não cria conta nem cadastro de atleta.
        </p>
      )}
      {!team.data && !team.error ? (
        <Skeleton lines={4} />
      ) : closed ? (
        <Alert kind="info">
          No momento estamos com o elenco completo e não estamos recebendo novos contatos para
          jogar. Quando abrir uma seletiva, ela aparece em <Link href="/eventos">Eventos</Link>.
        </Alert>
      ) : done ? (
        <Alert kind="success">Recebemos seu interesse! Em breve entraremos em contato.</Alert>
      ) : (
        <ApplicantForm
          submitLabel="Enviar interesse"
          extraField="notes"
          onSubmit={async (payload) => {
            await api('/public/interest', { method: 'POST', body: payload, auth: false });
            setDone(true);
          }}
        />
      )}
    </div>
  );
}
