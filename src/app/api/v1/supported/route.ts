import type { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { errors } from '@/lib/errors'
import { getClientIp, getRequestId } from '@/lib/api/request'
import { failUnknown, ok, preflight } from '@/lib/api/response'
import { SupportedQuerySchema } from '@/lib/api/schemas'
import { getSupported } from '@/server/catalog-service'
import type { ServiceCategory } from '@/server/resolver'
import { rateLimit } from '@/server/ratelimit'

export const runtime = 'nodejs'
export const revalidate = 60

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const rl = await rateLimit('read', getClientIp(req), env.RATE_LIMIT_READ, 60)
  const meta = {
    requestId,
    rateLimit: rl,
    extra: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  }

  try {
    if (!rl.allowed) return failUnknown(errors.rateLimited(rl.retryAfter), meta)

    const { searchParams } = new URL(req.url)
    const parsed = SupportedQuerySchema.safeParse({
      category: searchParams.get('category') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    })
    const filter: { category?: ServiceCategory; q?: string } = {}
    if (parsed.success) {
      if (parsed.data.category) filter.category = parsed.data.category
      if (parsed.data.q) filter.q = parsed.data.q
    }

    const result = await getSupported(filter)
    return ok(result, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}

export function OPTIONS() {
  return preflight()
}
