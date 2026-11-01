'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { Alert, ErrorSummary, TextField, useSubmit } from './ui';

/**
 * "Esqueci o código" (DT-096): reenvia o acesso dos pedidos sem conta para o e-mail da compra.
 * A resposta é sempre a mesma, exista ou não pedido com o e-mail.
 */
export function GuestResend() {
  const [email, setEmail] = useState('');
  const resend = useSubmit(async () => {
    const { message } = await api<{ message: string }>('/public/orders/resend-access', {
      method: 'POST',
      body: { email: email.trim() },
      auth: false
    });

    resend.setMessage(message);
  });

  return (
    <details className="card">
      <summary>Esqueci o código ou perdi o link</summary>
      <form className="stack pt-lg" onSubmit={(event) => void resend.submit(event)}>
        {resend.message ? <Alert kind="success">{resend.message}</Alert> : null}
        <ErrorSummary error={resend.error} />
        <TextField
          label="E-mail usado na compra"
          type="email"
          autoComplete="email"
          maxLength={180}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint="Enviamos de novo o número, o código e o link de cada pedido sem conta deste e-mail (e pelo WhatsApp, se você pediu)."
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary" disabled={resend.pending || !email}>
            {resend.pending ? 'Enviando…' : 'Reenviar acesso'}
          </button>
        </div>
      </form>
    </details>
  );
}
