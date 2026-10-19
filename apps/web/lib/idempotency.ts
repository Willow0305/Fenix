'use client';

import { useCallback, useRef } from 'react';

/**
 * Chave de idempotência por intenção de envio: reenvios do mesmo formulário (duplo clique,
 * nova tentativa após falha de rede) usam a mesma chave; após sucesso, uma nova é gerada.
 */
export function useIdempotencyKey(): { headers: () => Record<string, string>; rotate: () => void } {
  const key = useRef<string>(crypto.randomUUID());

  const headers = useCallback(() => ({ 'Idempotency-Key': key.current }), []);
  const rotate = useCallback(() => {
    key.current = crypto.randomUUID();
  }, []);

  return { headers, rotate };
}

/** Normaliza "89,90" ou "89.9" para o formato aceito pela API ("89.90"). */
export function normalizeAmount(input: string): string {
  const cleaned = input.trim().replace(/\s|R\$/g, '');
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;

  return /^\d+(\.\d{1,2})?$/.test(normalized) ? normalized : input.trim();
}
