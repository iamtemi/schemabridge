import { z } from 'zod';
import { currencyEnum } from '../common/enums.js';
import { productSchema } from '../inventory/product.js';
import { userSchema } from '../users/user.js';

export const orderLineSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  currency: currencyEnum,
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  user: userSchema,
  lines: z.array(orderLineSchema).min(1),
  total: z.number().positive(),
  currency: currencyEnum,
  placedAt: z.coerce.date(),
  notes: z.string().optional(),
  relatedProducts: z.array(productSchema).optional(),
});
