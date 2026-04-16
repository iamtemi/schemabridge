import { z } from 'zod';
import { currencyEnum, statusEnum } from '../common/enums.js';

export const productSchema = z.object({
  sku: z.string().min(3),
  name: z.string().min(1).max(120),
  status: statusEnum,
  price: z.number().positive(),
  currency: currencyEnum,
  tags: z.array(z.string()).default([]),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(['cm', 'in']),
    })
    .optional(),
});
