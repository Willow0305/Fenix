'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ApplicantForm } from '../../../../components/applicant-form';
import { Alert } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';

export function TryoutRegistrationForm({ slug }: { readonly slug: string }) {
  const { status } = useAuth();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Alert kind="success">
        Inscrição recebida! A diretoria vai analisar e entrar em contato. O envio não garante
        aprovação.{' '}
        {status === 'authenticated' ? (
          <Link href="/minha-conta/inscricoes">Acompanhar minhas inscrições</Link>
        ) : null}
      </Alert>
    );
  }

  return (
    <ApplicantForm
      submitLabel="Enviar inscrição"
      extraField="experience"
      intro={
        <>
          <h2>Inscrição</h2>
          {status === 'anonymous' ? (
            <p className="muted">
              Dica: <Link href={`/entrar?next=/seletivas/${slug}`}>entre na sua conta</Link> para
              acompanhar o resultado pela área do usuário. Não é obrigatório.
            </p>
          ) : null}
        </>
      }
      onSubmit={async (payload) => {
        await api(`/public/tryouts/${encodeURIComponent(slug)}/registrations`, {
          method: 'POST',
          body: payload
        });
        setDone(true);
      }}
    />
  );
}
