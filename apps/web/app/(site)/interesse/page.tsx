'use client';

import { useState } from 'react';

import { ApplicantForm } from '../../../components/applicant-form';
import { Alert } from '../../../components/ui';
import { api } from '../../../lib/api-client';

export default function InterestPage() {
  const [done, setDone] = useState(false);

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem', maxWidth: 860 }}>
      <h1>Quero jogar no Fênix</h1>
      <p className="muted">
        Deixe seu contato e a diretoria falará com você sobre treinos e próximas seletivas. O envio
        não cria conta nem cadastro de atleta.
      </p>
      {done ? (
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
