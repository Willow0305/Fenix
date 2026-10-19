'use client';

import { useState } from 'react';

import { Alert, ErrorSummary, TextField, useSubmit } from '../../../components/ui';
import { api } from '../../../lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const action = useSubmit(async () => {
    const result = await api<{ message: string }>('/auth/password/forgot', {
      method: 'POST',
      body: { email },
      auth: false
    });

    action.setMessage(result.message);
  });

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: '2.5rem' }}>
      <h1>Recuperar senha</h1>
      <form className="form card" onSubmit={(event) => void action.submit(event)}>
        {action.message ? <Alert kind="success">{action.message}</Alert> : null}
        <ErrorSummary error={action.error} />
        <TextField
          label="E-mail cadastrado"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Enviando…' : 'Enviar instruções'}
        </button>
      </form>
    </div>
  );
}
