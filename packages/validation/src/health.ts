import { z } from 'zod';

/**
 * Contrato do /health. Fica numa entrada separada (`@fenix/validation/health`) para o
 * `zod` não ir para o navegador junto com CPF, telefone e limites.
 */
export const technicalHealthSchema = z
  .object({
    service: z.string().min(1),
    status: z.literal('ok'),
    timestamp: z.string().datetime({
      offset: true
    })
  })
  .strict();
