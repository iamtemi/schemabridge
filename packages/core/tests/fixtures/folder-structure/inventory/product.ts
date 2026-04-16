import { z } from 'zod';

export const productSchema = z.object({
  sku: z.string(),
  price: z.number().positive(),
  tags: z.array(z.string()).default([]),
});
