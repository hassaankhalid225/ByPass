import { z } from 'zod'

/** Request schemas for the public API. Every handler parses through one of these. */

export const ResolveRequestSchema = z.object({
  url: z.string().min(1).max(2048),
  options: z
    .object({
      maxHops: z.number().int().min(1).max(20).optional(),
      includeChain: z.boolean().optional(),
      noCache: z.boolean().optional(),
    })
    .optional(),
})

export type ResolveRequestBody = z.infer<typeof ResolveRequestSchema>

export const SupportedQuerySchema = z.object({
  category: z.enum(['shortener', 'paste', 'ad-gate', 'social-gate', 'generic']).optional(),
  q: z.string().max(64).optional(),
})

export const AdminLoginSchema = z.object({
  password: z.string().min(1).max(256),
})

export const AdapterPatchSchema = z.object({
  enabled: z.boolean(),
})

export const CachePurgeSchema = z.object({
  url: z.string().max(2048).optional(),
})
