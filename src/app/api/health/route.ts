import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { BUILD_INFO, uptimeSeconds } from '@/lib/api/build-info'
import { pingRedis } from '@/server/redis'
import { getStore } from '@/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Health check. Deliberately NOT in the standard envelope — load balancers and
 * uptime monitors expect a flat document. See docs/04-api-specification.md §7.
 *  - default: liveness (always 200 if the process is up)
 *  - ?deep=1: readiness (pings cache and store; 503 if a configured dep is down)
 */
export async function GET(req: NextRequest) {
  const deep = new URL(req.url).searchParams.get('deep') === '1'

  if (!deep) {
    return NextResponse.json(
      { status: 'ok', uptimeSeconds: uptimeSeconds(), version: BUILD_INFO.version },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const store = await getStore()
  const [storeHealth, redisHealth] = await Promise.all([store.ready(), pingRedis()])

  const checks = {
    store: {
      status: storeHealth.ok ? 'ok' : 'down',
      driver: store.name,
      latencyMs: storeHealth.latencyMs,
    },
    cache:
      redisHealth === null
        ? { status: 'ok', driver: 'memory', latencyMs: 0 }
        : {
            status: redisHealth.ok ? 'ok' : 'down',
            driver: 'redis',
            latencyMs: redisHealth.latencyMs,
          },
  }

  const healthy = checks.store.status === 'ok' && checks.cache.status === 'ok'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      uptimeSeconds: uptimeSeconds(),
      version: BUILD_INFO.version,
      commit: BUILD_INFO.commit,
      checks,
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
