import { z } from 'zod'

/**
 * Environment configuration, parsed once at import time.
 *
 * A missing required variable or a malformed value throws here, at boot, with a
 * readable message — never at 3am with an "undefined is not a function". Every
 * other module imports the typed `env` object rather than touching process.env.
 */

const isProd = process.env.NODE_ENV === 'production'

const booleanish = z
  .string()
  .transform((v) => v === '1' || v.toLowerCase() === 'true')
  .pipe(z.boolean())

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )

const portList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 65535),
  )

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    APP_URL: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z.string().url().optional(),
    REDIS_URL: z.string().url().optional(),

    RESOLVE_HASH_SALT: z
      .string()
      .min(16, 'RESOLVE_HASH_SALT must be at least 16 chars (32+ recommended)')
      .default('dev-only-insecure-salt-change-me-in-production-1234'),

    ADMIN_PASSWORD_HASH: z.string().optional(),
    ADMIN_SESSION_SECRET: z.string().min(32).optional(),

    METRICS_TOKEN: z.string().optional(),

    TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).max(10).default(0),
    BLOCKED_HOSTS: csv,
    EXTRA_ALLOWED_PORTS: portList,

    RESOLVE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
    STEP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(6000),
    MAX_HOPS: z.coerce.number().int().min(1).max(20).default(10),
    MAX_RESPONSE_BYTES: z.coerce.number().int().min(1024).default(2_097_152),

    RATE_LIMIT_RESOLVE: z.coerce.number().int().min(1).default(30),
    RATE_LIMIT_READ: z.coerce.number().int().min(1).default(120),

    CACHE_TTL_SUCCESS_S: z.coerce.number().int().min(0).default(3600),
    CACHE_TTL_FAILURE_S: z.coerce.number().int().min(0).default(60),

    RETENTION_DAYS: z.coerce.number().int().min(1).default(30),

    BREAKER_THRESHOLD: z.coerce.number().int().min(1).default(5),
    BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1000).default(60000),
    BREAKER_MAX_COOLDOWN_MS: z.coerce.number().int().min(1000).default(900000),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    ENABLE_ADMIN_DEV: booleanish.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production') {
      if (val.RESOLVE_HASH_SALT.startsWith('dev-only')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESOLVE_HASH_SALT'],
          message: 'RESOLVE_HASH_SALT must be set to a unique value in production.',
        })
      }
      if (val.ADMIN_PASSWORD_HASH && !val.ADMIN_SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ADMIN_SESSION_SECRET'],
          message: 'ADMIN_SESSION_SECRET is required when ADMIN_PASSWORD_HASH is set.',
        })
      }
    }
  })

function parseEnv() {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    // Fail loud and early. This runs once, at module load.
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return parsed.data
}

export const env = parseEnv()

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/** Admin is only available when a password hash is configured. */
export const adminConfigured = Boolean(env.ADMIN_PASSWORD_HASH && env.ADMIN_SESSION_SECRET)

export type Env = typeof env

void isProd
