import { z } from 'zod';

// Comprehensive schema that exercises all supported Zod features
export const comprehensiveSchema = z.object({
  // String constraints
  name: z.string().min(1).max(100),
  email: z.email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  uuid: z.uuid(),
  datetime: z.iso.datetime(),
  date: z.iso.date(),

  // Number constraints
  age: z.number().int().min(0).max(150),
  score: z.number().positive(),
  rating: z.number().nonnegative().max(5),
  price: z.number().min(0).max(10000),
  quantity: z.int().nonnegative(),

  // Boolean
  isActive: z.boolean(),
  verified: z.boolean().default(false),

  // Enums and literals
  status: z.enum(['pending', 'active', 'inactive', 'archived']),
  priority: z.literal('high'),
  type: z.union([z.literal('user'), z.literal('admin'), z.literal('guest')]),

  // Arrays
  tags: z.array(z.string()),
  scores: z.array(z.number().int()),
  items: z.array(
    z.object({
      id: z.string(),
      value: z.number(),
    }),
  ),

  // Nested objects (3+ levels deep)
  address: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
      elevation: z.object({
        meters: z.number(),
        source: z.string().optional(),
      }),
    }),
  }),

  // Optional, nullable, nullish
  middleName: z.string().optional(),
  nickname: z.string().nullable(),
  alias: z.string().nullish(),
  metadata: z
    .object({
      key: z.string(),
      value: z.string(),
    })
    .optional(),

  // Default values
  settings: z.object({
    theme: z.enum(['light', 'dark']).default('light'),
    notifications: z.boolean().default(true),
  }),
  preferences: z.array(z.string()).default([]),
  config: z.object({}).default({}),

  // Unions with nested objects
  payment: z.union([
    z.object({
      method: z.literal('credit_card'),
      cardNumber: z.string(),
      expiry: z.string(),
    }),
    z.object({
      method: z.literal('paypal'),
      email: z.string().email(),
    }),
    z.object({
      method: z.literal('bank_transfer'),
      accountNumber: z.string(),
      routingNumber: z.string(),
    }),
  ]),

  // Any and unknown
  extraData: z.any(),
  unknownField: z.unknown(),

  // Complex nested structure
  profile: z.object({
    bio: z.string().optional(),
    avatar: z.string().url().nullable(),
    social: z
      .object({
        twitter: z.string().optional(),
        linkedin: z.string().optional(),
        github: z.string().optional(),
      })
      .optional(),
  }),
});
