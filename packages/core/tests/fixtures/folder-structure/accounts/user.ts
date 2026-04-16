import { z } from 'zod';

export const userAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  profile: z.object({
    nickname: z.string().optional(),
  }),
});
