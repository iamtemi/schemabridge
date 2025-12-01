import { z } from 'zod';

// Realistic database entity patterns

export const timestampFields = z.object({
  created_at: z.date(),
  updated_at: z.iso.date(),
  deleted_at: z.string().datetime().nullable(), // Soft delete
});

export const userStatus = z.enum(['active', 'inactive', 'suspended', 'pending_verification']);

export const userEntitySchema = z.object({
  // Primary key
  id: z.uuid(),

  // Basic fields
  email: z.email(),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/),
  full_name: z.string().min(1).max(200),
  status: userStatus,

  // Foreign key references
  organization_id: z.string().uuid().nullable(),
  team_id: z.uuid().optional(),

  // Timestamps
  ...timestampFields.shape,

  // Metadata
  metadata: z
    .object({
      last_login: z.iso.datetime().nullable(),
      login_count: z.number().int().nonnegative().default(0),
      preferences: z
        .object({
          theme: z.enum(['light', 'dark', 'auto']).default('auto'),
          language: z.string().default('en'),
          notifications: z.boolean().default(true),
        })
        .default({
          theme: 'auto',
          language: 'en',
          notifications: true,
        }),
    })
    .optional(),

  // Related entities (nested)
  organization: z
    .object({
      id: z.uuid(),
      name: z.string(),
      domain: z.string().optional(),
      ...timestampFields.shape,
    })
    .optional(),

  // Array of related entities
  roles: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      permissions: z.array(z.string()),
      assigned_at: z.string().datetime(),
    }),
  ),

  // Complex nested structure
  profile: z
    .object({
      bio: z.string().max(500).nullable(),
      avatar_url: z.string().url().nullable(),
      location: z
        .object({
          city: z.string().optional(),
          country: z.string().optional(),
          timezone: z.string().optional(),
        })
        .optional(),
      social_links: z
        .object({
          twitter: z.url().optional(),
          linkedin: z.url().optional(),
          github: z.url().optional(),
        })
        .optional(),
    })
    .optional(),
});
