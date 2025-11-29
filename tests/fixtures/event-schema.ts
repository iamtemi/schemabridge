import { z } from 'zod';

// Realistic event/notification patterns with discriminated unions

export const userEvent = z.object({
  type: z.literal('user_created'),
  userId: z.string().uuid(),
  email: z.string().email(),
  timestamp: z.string().datetime(),
  eventMetadata: z
    .object({
      source: z.enum(['web', 'api', 'admin']),
      ipAddress: z.string().optional(),
    })
    .optional(),
});

export const orderEvent = z.object({
  type: z.literal('order_placed'),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    }),
  ),
  timestamp: z.string().datetime(),
});

export const paymentEvent = z.object({
  type: z.literal('payment_processed'),
  paymentId: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['credit_card', 'paypal', 'bank_transfer']),
  status: z.enum(['success', 'failed', 'pending']),
  timestamp: z.string().datetime(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export const notificationEvent = z.object({
  type: z.literal('notification_sent'),
  notificationId: z.string().uuid(),
  userId: z.string().uuid(),
  channel: z.enum(['email', 'sms', 'push', 'in_app']),
  template: z.string(),
  data: z.any(),
  timestamp: z.string().datetime(),
  delivered: z.boolean().default(false),
});

// Discriminated union pattern - all events have a 'type' field
export const eventSchema = z.object({
  // Event discriminator
  eventType: z.enum(['user_created', 'order_placed', 'payment_processed', 'notification_sent']),

  // Union of event payloads
  payload: z.union([userEvent, orderEvent, paymentEvent, notificationEvent]),

  // Common metadata
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),

  // Actor information
  actor: z.object({
    userId: z.string().uuid().optional(),
    system: z.boolean().default(false),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
  }),

  // Event-specific metadata
  metadata: z
    .object({
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      tags: z.array(z.string()).default([]),
      environment: z.enum(['development', 'staging', 'production']).optional(),
    })
    .optional(),

  // Related events
  relatedEvents: z.array(z.string().uuid()).default([]),
});
