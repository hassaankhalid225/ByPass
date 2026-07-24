import type { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/request'
import { failUnknown, ok } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-guard'
import { registry } from '@/server/resolver'
import { getStore } from '@/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List all adapters with live health, traffic, and operator state. */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req)
  const meta = { requestId }
  try {
    await requireAdmin(req)
    const store = await getStore()
    const [health, states] = await Promise.all([store.adapterHealth24h(), store.listAdapterState()])
    const healthById = new Map(health.map((h) => [h.adapterId, h]))
    const stateById = new Map(states.map((s) => [s.adapterId, s]))

    const adapters = registry.all().map((adapter) => {
      const h = healthById.get(adapter.id)
      const st = stateById.get(adapter.id)
      return {
        id: adapter.id,
        name: adapter.name,
        category: adapter.category,
        hosts: adapter.hosts ?? [],
        listed: adapter.listed !== false,
        unavailable: adapter.unavailable ?? false,
        enabled: st?.enabled ?? true,
        breaker: st?.breakerState ?? 'closed',
        samples: h?.samples ?? 0,
        successRate: h?.successRate ?? null,
        p95Ms: h?.p95Ms ?? null,
        lastFailureAt: st?.lastFailureAt?.toISOString() ?? null,
        note: st?.note ?? null,
      }
    })

    return ok({ adapters }, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}
