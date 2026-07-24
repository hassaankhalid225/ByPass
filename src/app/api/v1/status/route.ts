import type { NextRequest } from 'next/server'
import { errors } from '@/lib/errors'
import { getClientIp, getRequestId } from '@/lib/api/request'
import { failUnknown, ok } from '@/lib/api/response'
import { rateLimit } from '@/server/ratelimit'
import { getStatus } from '@/server/status-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const rl = await rateLimit('read', getClientIp(req), 60, 60)
  const meta = {
    requestId,
    rateLimit: rl,
    extra: { 'Cache-Control': 'public, max-age=30' },
  }

  try {
    if (!rl.allowed) return failUnknown(errors.rateLimited(rl.retryAfter), meta)
    const result = await getStatus()
    return ok(result, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}
