import { z } from 'zod';

export const metadataSchema = z.object({
  source: z.enum(['api', 'ui']),
  tags: z.array(z.string()).default([]),
});
