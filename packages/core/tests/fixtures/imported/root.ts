import { z } from 'zod';
import { metadataSchema } from './metadata.js';

export const importedSchema = z.object({
  id: z.string().uuid(),
  metadata: metadataSchema,
});
