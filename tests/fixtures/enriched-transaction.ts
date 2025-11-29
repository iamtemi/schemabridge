import { z } from 'zod';

const versionPattern = /^v\d{6}-\d{2}-\d+\.\d+\.\d+$/;

export const metadataSchema = z.object({
  source: z.enum(['api', 'ui']),
  tags: z.array(z.string()).default([]),
});

export const enrichedTransactionSchema = z.object({
  version: z.string().regex(versionPattern),
  id: z.uuid(),
  amount: z.number().positive(),
  normalized: z.object({
    description: z.string(),
    description_tokens: z.array(z.string()),
    metadata: metadataSchema.optional(),
  }),
  status: z.union([
    z.object({
      kind: z.literal('pending'),
      reason: z.string().optional(),
    }),
    z.object({
      kind: z.literal('completed'),
      completed_at: z.iso.datetime(),
    }),
  ]),
  flags: z.array(z.enum(['fraud', 'manual_review'])).optional(),
});
