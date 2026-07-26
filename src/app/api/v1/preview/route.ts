import type { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { AppError, errors } from '@/lib/errors'
import { getClientIp, getRequestId, parseJsonBody } from '@/lib/api/request'
import { failUnknown, ok, preflight } from '@/lib/api/response'
import { PreviewRequestSchema } from '@/lib/api/schemas'
import { getPreview } from '@/server/preview-service'
import { rateLimit } from '@/server/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

/** Fetch a destination's preview metadata + QR. Best-effort, SSRF-guarded. */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const clientIp = getClientIp(req)

  const rl = await rateLimit('preview', clientIp, env.RATE_LIMIT_RESOLVE, 60)
  const meta = { requestId, rateLimit: rl }

  try {
    if (!rl.allowed) return failUnknown(errors.rateLimited(rl.retryAfter), meta)

    const raw = await parseJsonBody(req)
    const parsed = PreviewRequestSchema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'The request body was not valid.', {
        details: { fields: parsed.error.flatten().fieldErrors },
      })
    }

    const preview = await getPreview(parsed.data.url, requestId)
    return ok(preview, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}

export function OPTIONS() {
  return preflight()
}
