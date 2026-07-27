import type { NextRequest } from 'next/server'
import { AppError, errors } from '@/lib/errors'
import { mapLimit } from '@/lib/concurrency'
import { getClientIp, getRequestId, parseJsonBody } from '@/lib/api/request'
import { failUnknown, ok, preflight } from '@/lib/api/response'
import { BatchRequestSchema } from '@/lib/api/schemas'
import { metrics } from '@/server/metrics'
import { rateLimit } from '@/server/ratelimit'
import { resolveLink } from '@/server/resolve-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const CONCURRENCY = 4

/** Resolve up to 10 links in one call, with bounded concurrency. */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const clientIp = getClientIp(req)

  // Stricter limit than single resolve — each call does up to 10x the work.
  const rl = await rateLimit('batch', clientIp, 6, 60)
  const meta = { requestId, rateLimit: rl }

  try {
    if (!rl.allowed) {
      metrics.recordRateLimitRejected()
      return failUnknown(errors.rateLimited(rl.retryAfter), meta)
    }

    const raw = await parseJsonBody(req)
    const parsed = BatchRequestSchema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Send { urls: string[] } with 1–10 links.', {
        details: { fields: parsed.error.flatten().fieldErrors },
      })
    }

    const results = await mapLimit(parsed.data.urls, CONCURRENCY, async (url) => {
      try {
        const data = await resolveLink({
          rawUrl: url,
          maxHops: 10,
          noCache: false,
          includeChain: false,
          requestId,
          clientId: clientIp === 'unknown' ? null : clientIp,
        })
        return {
          input: url,
          ok: true as const,
          status: data.status,
          destination: data.destination,
          hops: data.hops,
          service: data.service,
        }
      } catch (err) {
        const code = AppError.is(err) ? err.code : 'INTERNAL_ERROR'
        const message = AppError.is(err) ? err.message : 'Could not resolve this link.'
        return { input: url, ok: false as const, code, message }
      }
    })

    return ok({ count: results.length, results }, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}

export function OPTIONS() {
  return preflight()
}
