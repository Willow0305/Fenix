'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Alert, ErrorSummary, useSubmit } from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { plural } from '../../../lib/format';

/**
 * Confirmação do e-mail pelo link (DT-096). Pede um clique: verificadores de link dos
 * provedores de e-mail abrem a página sozinhos e não podem gastar o link no lugar da pessoa.
 */
function Confirm() {
  const token = useSearchParams().get('token') ?? '';
  const { status, reloadProfile } = useAuth();
  const [linked, setLinked] = useState<number | null>(null);
  const action = useSubmit(async () => {
    const result = await api<{ linkedOrders: number }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
      auth: false
    });

    setLinked(result.linkedOrders);

    if (status === 'authenticated') {
      await reloadProfile();
    }
  });

  if (!token) {
    return <Alert kind="error">Link inválido. Peça um novo em Minha conta.</Alert>;
  }

  if (linked !== null) {
    return (
      <Alert kind="success">
        E-mail confirmado.{' '}
        {linked > 0
          ? `${plural(linked, 'pedido feito', 'pedidos feitos')} sem conta com este e-mail ${linked === 1 ? 'passou' : 'passaram'} para a sua conta. `
          : ''}
        <Link href={status === 'authenticated' ? '/minha-conta/pedidos' : '/entrar'}>
          {status === 'authenticated' ? 'Ver meus pedidos' : 'Entrar'}
        </Link>
      </Alert>
    );
  }

  return (
    <div className="card stack">
      <p className="m-0">
        Confirme que este e-mail é seu. As compras feitas na loja sem conta, com este mesmo e-mail,
        passam para a sua conta.
      </p>
      <ErrorSummary error={action.error} />
      <div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={action.pending}
          onClick={() => void action.submit()}
        >
          {action.pending ? 'Confirmando…' : 'Confirmar meu e-mail'}
        </button>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <div className="container stack pt-xl" style={{ maxWidth: 560 }}>
      <h1>Confirmar e-mail</h1>
      <Suspense>
        <Confirm />
      </Suspense>
    </div>
  );
}
