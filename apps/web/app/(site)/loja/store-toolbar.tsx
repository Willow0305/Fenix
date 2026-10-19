'use client';

import Link from 'next/link';

import { useAuth } from '../../../lib/auth-context';
import { useCart } from '../../../lib/cart-context';

/** Atalhos da loja: carrinho, favoritos e consulta de pedido ficam no contexto da loja (RN-LOJ-009). */
export function StoreToolbar() {
  const { cart } = useCart();
  const { status } = useAuth();

  return (
    <div className="row">
      {status === 'authenticated' ? (
        <Link href="/minha-conta/favoritos" className="btn btn-secondary btn-sm">
          Favoritos
        </Link>
      ) : null}
      <Link href="/loja/pedido" className="btn btn-secondary btn-sm">
        Consultar pedido
      </Link>
      <Link href="/loja/carrinho" className="btn btn-primary btn-sm">
        Carrinho{cart && cart.itemCount > 0 ? ` (${cart.itemCount})` : ''}
      </Link>
    </div>
  );
}
