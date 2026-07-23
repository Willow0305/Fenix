import { z } from 'zod';

export const technicalHealthSchema = z
  .object({
    service: z.string().min(1),
    status: z.literal('ok'),
    timestamp: z.string().datetime({
      offset: true
    })
  })
  .strict();
