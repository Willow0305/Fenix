'use client';

import { useState } from 'react';

import {
  Alert,
  ErrorSummary,
  PageHeader,
  PhoneField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Profile } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDateTime } from '../../../lib/format';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  board: 'Diretoria',
  athlete: 'Atleta',
  user: 'Usuário'
};

export default function AccountOverviewPage() {
  const { profile, reloadProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const action = useSubmit(async () => {
    await api<Profile>('/me', { method: 'PATCH', body: { name, phone } });
    await reloadProfile();
    action.setMessage('Dados atualizados.');
  });

  if (!profile) {
    return null;
  }

  return (
    <>
      <PageHeader
        title={`Olá, ${profile.name.split(' ')[0]}`}
        description={`Conta criada em ${formatDateTime(profile.createdAt)}`}
      />
      <div className="row">
        {profile.roles.map((role) => (
          <span key={role} className="badge badge-brand">
            {ROLE_LABELS[role] ?? role}
          </span>
        ))}
      </div>
      <form className="form card" onSubmit={(event) => void action.submit(event)}>
        <h2>Meus dados</h2>
        {action.message ? <Alert kind="success">{action.message}</Alert> : null}
        <ErrorSummary error={action.error} />
        <TextField
          label="Nome"
          maxLength={160}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="E-mail"
          maxLength={180}
          value={profile.email}
          disabled
          hint="Para alterar o e-mail, procure a administração."
        />
        <PhoneField label="Celular" value={phone} onValueChange={setPhone} />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={action.pending}>
            Salvar
          </button>
        </div>
      </form>
    </>
  );
}
