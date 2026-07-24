import type { NextRequest } from 'next/server'
import { saltedHash } from '@/lib/hash'
import { getRequestId, parseJsonBody } from '@/lib/api/request'
import { failUnknown, ok } from '@/lib/api/response'
import { CachePurgeSchema } from '@/lib/api/schemas'
import { requireAdmin } from '@/lib/api/admin-guard'
import { getCache } from '@/server/cache'
import { normalizeUrl } from '@/lib/url/normalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_PREFIX = 'resolve:v1:'

/** Purge one cached resolution, or the whole resolve namespace. */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const meta = { requestId }
  try {
    await requireAdmin(req)
    const body = await parseJsonBody(req)
    const parsed = CachePurgeSchema.safeParse(body)
    const cache = await getCache()

    if (parsed.success && parsed.data.url) {
      try {
        const { href } = normalizeUrl(parsed.data.url)
        await cache.delete(CACHE_PREFIX + saltedHash(href))
        return ok({ purged: 1 }, meta)
      } catch {
        return ok({ purged: 0 }, meta)
      }
    }

    const purged = await cache.deletePrefix(CACHE_PREFIX)
    return ok({ purged }, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}
