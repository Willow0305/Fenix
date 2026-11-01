'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { guestOrderLink, rememberGuestOrder } from '../lib/guest-orders';
import { Icon } from './icon';

/**
 * Acesso ao pedido de quem comprou sem conta (DT-096): código fácil, link fixo para guardar
 * e o pedido já lembrado neste aparelho, onde a compra acabou de ser feita.
 */
export function GuestOrderAccess({
  orderNumber,
  code
}: {
  readonly orderNumber: string;
  readonly code: string;
}) {
  const [copied, setCopied] = useState(false);
  const path = guestOrderLink(orderNumber, code);

  useEffect(() => {
    rememberGuestOrder({ orderNumber, code });
  }, [orderNumber, code]);

  return (
    <section className="alert alert-warning stack gap-sm" aria-labelledby="acesso-pedido">
      <strong id="acesso-pedido">Guarde o acesso ao seu pedido</strong>
      <p className="m-0">
        Número <strong>{orderNumber}</strong> e código de acesso <strong>{code}</strong>. O link
        abaixo abre o pedido direto e não muda; também enviamos por e-mail (e por WhatsApp, se você
        pediu).
      </p>
      <div className="row">
        <Link href={path} className="btn btn-primary btn-sm">
          <Icon name="box-arrow-up-right" /> Abrir meu pedido
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(`${window.location.origin}${path}`)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          <Icon name="clipboard" /> {copied ? 'Link copiado!' : 'Copiar link'}
        </button>
      </div>
      <p className="m-0 text-sm">
        Este pedido fica lembrado neste aparelho em Loja › Consultar pedido. Se o e-mail não chegar
        em alguns minutos, olhe a caixa de spam.
      </p>
    </section>
  );
}
