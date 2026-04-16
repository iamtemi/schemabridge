import { z } from 'zod';

// Realistic configuration schema patterns

export const databaseConfig = z.object({
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().default(false),
  pool: z.object({
    min: z.number().int().min(1).default(2),
    max: z.number().int().min(1).default(10),
    idleTimeout: z.number().int().nonnegative().default(30000),
  }),
});

export const cacheConfig = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(['memory', 'redis', 'memcached']).default('memory'),
  ttl: z.number().int().nonnegative().default(3600),
  redis: z
    .object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      password: z.string().optional(),
    })
    .optional(),
});

export const loggingConfig = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'text']).default('json'),
  output: z.enum(['console', 'file', 'both']).default('console'),
  file: z
    .object({
      path: z.string().default('./logs'),
      maxSize: z.number().int().positive().default(10485760), // 10MB
      maxFiles: z.number().int().positive().default(5),
    })
    .optional(),
});

export const configSchema = z.object({
  // Environment
  env: z.enum(['development', 'staging', 'production']).default('development'),
  debug: z.boolean().default(false),

  // Server configuration
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().min(1).max(65535).default(3000),
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(['*']),
    }),
  }),

  // Database
  database: databaseConfig,

  // Cache
  cache: cacheConfig,

  // Logging
  logging: loggingConfig,

  // Feature flags
  features: z.object({
    enableAuth: z.boolean().default(true),
    enableMetrics: z.boolean().default(false),
    enableTracing: z.boolean().default(false),
    rateLimiting: z
      .object({
        enabled: z.boolean().default(false),
        maxRequests: z.number().int().positive().default(100),
        windowMs: z.number().int().positive().default(60000),
      })
      .optional(),
  }),
  // API keys and secrets
  secrets: z
    .object({
      jwtSecret: z.string().min(32),
      apiKey: z.string().optional(),
      encryptionKey: z.string().min(32).optional(),
    })
    .optional(),

  // Validation rules
  validation: z.object({
    strictMode: z.boolean().default(false),
    allowUnknownFields: z.boolean().default(false),
    maxDepth: z.number().int().positive().default(10),
  }),
});
