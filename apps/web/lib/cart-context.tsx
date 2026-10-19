'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api } from './api-client';
import { useAuth } from './auth-context';
import type { Cart } from './store-types';

interface CartState {
  readonly cart: Cart | null;
  readonly reload: () => Promise<void>;
  readonly setQuantity: (variantId: string, quantity: number) => Promise<Cart>;
}

const CartContext = createContext<CartState | null>(null);

/** Carrinho compartilhado entre cabeçalho e loja; o servidor é a fonte de verdade (RF-037). */
export function CartProvider({ children }: { readonly children: ReactNode }) {
  const { status } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);

  const reload = useCallback(async () => {
    try {
      setCart(await api<Cart>('/cart'));
    } catch {
      setCart(null);
    }
  }, []);

  useEffect(() => {
    if (status !== 'loading') {
      void reload();
    }
  }, [status, reload]);

  const setQuantity = useCallback(async (variantId: string, quantity: number) => {
    const updated = await api<Cart>('/cart/items', {
      method: 'PUT',
      body: { variantId, quantity }
    });

    setCart(updated);

    return updated;
  }, []);

  return (
    <CartContext.Provider value={{ cart, reload, setQuantity }}>{children}</CartContext.Provider>
  );
}

export function useCart(): CartState {
  const context = useContext(CartContext);

  if (context === null) {
    throw new Error('useCart deve ser usado dentro de CartProvider.');
  }

  return context;
}
