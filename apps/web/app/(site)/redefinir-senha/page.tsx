'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Alert, ErrorSummary, TextField, useSubmit } from '../../../components/ui';
import { api } from '../../../lib/api-client';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const action = useSubmit(async () => {
    await api('/auth/password/reset', { method: 'POST', body: { token, password }, auth: false });
    setDone(true);
  });

  if (!token) {
    return <Alert kind="error">Link inválido. Solicite uma nova redefinição.</Alert>;
  }

  if (done) {
    return (
      <Alert kind="success">
        Senha redefinida. Todas as sessões anteriores foram encerradas.{' '}
        <Link href="/entrar">Entrar</Link>
      </Alert>
    );
  }

  return (
    <form className="form card" onSubmit={(event) => void action.submit(event)}>
      <ErrorSummary error={action.error} />
      <TextField
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="Mínimo de 10 caracteres, com letras e números."
        error={action.fieldError('password')}
      />
      <button type="submit" className="btn btn-primary" disabled={action.pending}>
        Redefinir senha
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: '2.5rem' }}>
      <h1>Redefinir senha</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
