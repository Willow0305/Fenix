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

export * from './br-documents';
export * from './field-limits';
