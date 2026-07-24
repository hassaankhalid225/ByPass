import { registry } from './resolver'
import { getStore } from './store'

/** Read model for /status: system summary + per-adapter health. */

export type SystemStatus = 'operational' | 'degraded' | 'down'

export interface AdapterStatusView {
  id: string
  name: string
  status: 'operational' | 'degraded' | 'down' | 'unavailable'
  successRate: number | null
  samples: number
  p95Ms: number | null
  breaker: 'closed' | 'open' | 'half-open'
  lastFailureAt: string | null
}

export interface StatusResult {
  status: SystemStatus
  generatedAt: string
  window: '24h'
  summary: {
    resolutions: number
    successRate: number | null
    p50Ms: number | null
    p95Ms: number | null
    cacheHitRate: number | null
  }
  adapters: AdapterStatusView[]
}

export async function getStatus(): Promise<StatusResult> {
  const store = await getStore()
  const [summary, health, states] = await Promise.all([
    store.systemSummary24h(),
    store.adapterHealth24h(),
    store.listAdapterState(),
  ])

  const healthById = new Map(health.map((h) => [h.adapterId, h]))
  const stateById = new Map(states.map((s) => [s.adapterId, s]))

  const adapters: AdapterStatusView[] = registry
    .all()
    .filter((a) => a.listed !== false && a.id !== 'http-redirect')
    .map((adapter) => {
      const h = healthById.get(adapter.id)
      const st = stateById.get(adapter.id)
      const breaker = st?.breakerState ?? 'closed'
      let status: AdapterStatusView['status']
      if (adapter.unavailable) status = 'unavailable'
      else if (st?.enabled === false || breaker === 'open') status = 'down'
      else if (breaker === 'half-open') status = 'degraded'
      else if (h?.successRate == null) status = 'operational'
      else if (h.successRate >= 0.9) status = 'operational'
      else if (h.successRate >= 0.5) status = 'degraded'
      else status = 'down'

      return {
        id: adapter.id,
        name: adapter.name,
        status,
        successRate: h?.successRate ?? null,
        samples: h?.samples ?? 0,
        p95Ms: h?.p95Ms ?? null,
        breaker,
        lastFailureAt: st?.lastFailureAt ? st.lastFailureAt.toISOString() : null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Derive overall status from the summary and any down adapters.
  let status: SystemStatus = 'operational'
  const anyDown = adapters.some((a) => a.status === 'down')
  const rate = summary.successRate
  if (rate !== null && rate < 0.5) status = 'down'
  else if (anyDown || (rate !== null && rate < 0.95)) status = 'degraded'

  return {
    status,
    generatedAt: new Date().toISOString(),
    window: '24h',
    summary,
    adapters,
  }
}
