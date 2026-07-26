import type { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { AppError, errors } from '@/lib/errors'
import { getClientIp, getRequestId, parseJsonBody } from '@/lib/api/request'
import { failUnknown, ok, preflight } from '@/lib/api/response'
import { ResolveRequestSchema } from '@/lib/api/schemas'
import { metrics } from '@/server/metrics'
import { rateLimit } from '@/server/ratelimit'
import { resolveLink } from '@/server/resolve-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Allow a full resolve chain to complete on serverless platforms (Vercel etc.).
// Keep RESOLVE_TIMEOUT_MS below this so the engine aborts before the platform does.
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const clientIp = getClientIp(req)

  const rl = await rateLimit('resolve', clientIp, env.RATE_LIMIT_RESOLVE, 60)
  const meta = { requestId, rateLimit: rl }

  try {
    if (!rl.allowed) {
      metrics.recordRateLimitRejected()
      return failUnknown(errors.rateLimited(rl.retryAfter), meta)
    }

    const raw = await parseJsonBody(req)
    const parsed = ResolveRequestSchema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'The request body was not valid.', {
        details: { fields: parsed.error.flatten().fieldErrors },
      })
    }

    const { url, options } = parsed.data
    const result = await resolveLink({
      rawUrl: url,
      maxHops: options?.maxHops ?? env.MAX_HOPS,
      noCache: options?.noCache ?? false,
      includeChain: options?.includeChain ?? true,
      requestId,
      clientId: clientIp === 'unknown' ? null : clientIp,
    })

    return ok(
      {
        status: result.status,
        source: result.source,
        destination: result.destination,
        hops: result.hops,
        cached: result.cached,
        durationMs: result.durationMs,
        resolvedAt: result.resolvedAt,
        service: result.service,
        chain: result.chain,
        warnings: result.warnings,
      },
      meta,
    )
  } catch (err) {
    return failUnknown(err, meta)
  }
}

export async function GET() {
  return failUnknown(new AppError('METHOD_NOT_ALLOWED', 'Use POST to resolve a link.'), {
    requestId: 'r_method',
  })
}

export function OPTIONS() {
  return preflight()
}
