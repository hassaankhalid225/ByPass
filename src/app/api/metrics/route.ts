import type { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { BUILD_INFO } from '@/lib/api/build-info'
import { metrics } from '@/server/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Prometheus text exposition. Gated by METRICS_TOKEN when set; otherwise restrict
 * by network at the proxy. See docs/04-api-specification.md §8.
 */
export async function GET(req: NextRequest) {
  if (env.METRICS_TOKEN) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${env.METRICS_TOKEN}`) {
      return new Response('Unauthorized\n', { status: 401 })
    }
  }

  const body = metrics.render(BUILD_INFO.version, BUILD_INFO.commit)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
