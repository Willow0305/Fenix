'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { forgetGuestOrder, type GuestOrderRef } from '../lib/guest-orders';
import type { Order } from '../lib/store-types';
import { ErrorSummary, useSubmit } from './ui';

/**
 * Logado, quem abriu um pedido feito sem conta traz ele para a conta (DT-096): passa a
 * aparecer em Meus pedidos e os avisos vêm pela conta.
 */
export function ClaimGuestOrder({
  order,
  access
}: {
  readonly order: Order;
  readonly access: GuestOrderRef;
}) {
  const { status } = useAuth();
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const done = useRef<HTMLParagraphElement>(null);
  const claim = useSubmit(async () => {
    const claimed = await api<Order>('/me/orders/claim', { method: 'POST', body: access });

    // Na conta, o pedido não precisa mais ficar lembrado neste aparelho.
    forgetGuestOrder(claimed.orderNumber);
    setClaimedId(claimed.id);
  });

  // O botão some ao trazer o pedido: o foco vai para a confirmação no lugar dele.
  useEffect(() => {
    if (claimedId) {
      done.current?.focus();
    }
  }, [claimedId]);

  if (status !== 'authenticated' || !order.isGuest) {
    return null;
  }

  return (
    <section className="card stack gap-sm" aria-labelledby="trazer-pedido">
      <h2 id="trazer-pedido" className="m-0 h-small">
        Este pedido foi feito sem conta
      </h2>
      {claimedId ? (
        <p className="m-0" role="status" ref={done} tabIndex={-1}>
          Pedido trazido para a sua conta.{' '}
          <Link href={`/minha-conta/pedidos/${claimedId}`}>Ver em Meus pedidos</Link>
        </p>
      ) : (
        <>
          <p className="m-0">
            Traga para a sua conta: ele passa a aparecer em Meus pedidos e os avisos chegam pela
            conta.
          </p>
          <ErrorSummary error={claim.error} />
          <div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={claim.pending}
              onClick={() => void claim.submit()}
            >
              {claim.pending ? 'Trazendo…' : 'Trazer para minha conta'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
