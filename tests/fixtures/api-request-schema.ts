import { z } from 'zod';

// Realistic API request/response patterns

export const paginationParams = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const filterParams = z.object({
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
});

export const apiRequestSchema = z.object({
  // Request metadata
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  headers: z.object({
    'Content-Type': z.string(),
    Authorization: z.string().optional(),
    'X-Request-ID': z.uuid().optional(),
    'User-Agent': z.string().optional(),
  }),

  // Query parameters
  query: z
    .object({
      search: z.string().optional(),
      filters: filterParams.optional(),
      pagination: paginationParams.optional(),
    })
    .optional(),

  // Request body (varies by endpoint)
  body: z.union([
    z.object({
      type: z.literal('create'),
      data: z.object({
        name: z.string().min(1),
        email: z.email(),
        age: z.number().int().min(0).optional(),
      }),
    }),
    z.object({
      type: z.literal('update'),
      id: z.uuid(),
      data: z.object({
        name: z.string().min(1).optional(),
        email: z.email().optional(),
      }),
    }),
    z.object({
      type: z.literal('delete'),
      id: z.uuid(),
      reason: z.string().optional(),
    }),
  ]),

  // Response structure
  response: z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional(),
      })
      .optional(),
    meta: z
      .object({
        requestId: z.uuid(),
        timestamp: z.date(),
        duration: z.number().nonnegative(),
        pagination: paginationParams.optional(),
      })
      .optional(),
  }),
});
