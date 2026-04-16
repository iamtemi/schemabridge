import { z } from 'zod';
import { roleEnum, statusEnum } from '../common/enums.js';

export const profileSchema = z.object({
  bio: z.string().max(240).optional(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
    .optional(),
  social: z
    .object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  status: statusEnum,
  roles: z.array(roleEnum).nonempty(),
  createdAt: z.coerce.date(),
  profile: profileSchema.optional(),
});
