import { registry } from './resolver'
import type { ServiceCategory } from './resolver'
import { getStore } from './store'
import type { AdapterHealth, AdapterStateRow } from './store'

/**
 * Read models for /supported and /status. Joins the static registry to live health
 * (from the store) and operator state (enabled/breaker), and derives a public
 * status label per service.
 */

export type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unavailable'

export interface ServiceView {
  id: string
  slug: string
  name: string
  category: ServiceCategory
  domains: string[]
  description: string | null
  status: ServiceStatus
  successRate: number | null
  enabled: boolean
}

export interface CategoryView {
  id: ServiceCategory
  label: string
  count: number
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  shortener: 'Link shorteners',
  paste: 'Paste hosts',
  'ad-gate': 'Ad gates',
  'social-gate': 'Social-unlock gates',
  generic: 'Generic techniques',
}

const CATEGORY_ORDER: ServiceCategory[] = [
  'shortener',
  'paste',
  'generic',
  'ad-gate',
  'social-gate',
]

function deriveStatus(
  adapter: { unavailable?: boolean },
  health: AdapterHealth | undefined,
  state: AdapterStateRow | undefined,
): { status: ServiceStatus; successRate: number | null; enabled: boolean } {
  const enabled = state?.enabled ?? true
  if (adapter.unavailable) return { status: 'unavailable', successRate: null, enabled }
  if (!enabled) return { status: 'down', successRate: health?.successRate ?? null, enabled }
  if (state?.breakerState === 'open') {
    return { status: 'down', successRate: health?.successRate ?? null, enabled }
  }
  if (state?.breakerState === 'half-open') {
    return { status: 'degraded', successRate: health?.successRate ?? null, enabled }
  }

  const rate = health?.successRate ?? null
  if (rate === null) return { status: 'operational', successRate: null, enabled }
  if (rate >= 0.9) return { status: 'operational', successRate: rate, enabled }
  if (rate >= 0.5) return { status: 'degraded', successRate: rate, enabled }
  return { status: 'down', successRate: rate, enabled }
}

export interface SupportedResult {
  total: number
  categories: CategoryView[]
  services: ServiceView[]
}

export async function getSupported(filter?: {
  category?: ServiceCategory
  q?: string
}): Promise<SupportedResult> {
  const store = await getStore()
  const [health, states] = await Promise.all([store.adapterHealth24h(), store.listAdapterState()])
  const healthById = new Map(health.map((h) => [h.adapterId, h]))
  const stateById = new Map(states.map((s) => [s.adapterId, s]))

  const all = registry.listed().map<ServiceView>((adapter) => {
    const derived = deriveStatus(adapter, healthById.get(adapter.id), stateById.get(adapter.id))
    return {
      id: adapter.id,
      slug: adapter.id,
      name: adapter.name,
      category: adapter.category,
      domains: [...(adapter.hosts ?? [])],
      description: adapter.description ?? null,
      status: derived.status,
      successRate: derived.successRate,
      enabled: derived.enabled,
    }
  })

  const filtered = all.filter((s) => {
    if (filter?.category && s.category !== filter.category) return false
    if (filter?.q) {
      const q = filter.q.toLowerCase()
      const inName = s.name.toLowerCase().includes(q)
      const inSlug = s.slug.toLowerCase().includes(q)
      const inDomain = s.domains.some((d) => d.includes(q))
      if (!inName && !inSlug && !inDomain) return false
    }
    return true
  })

  const categories: CategoryView[] = CATEGORY_ORDER.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    count: all.filter((s) => s.category === id).length,
  })).filter((c) => c.count > 0)

  return { total: all.length, categories, services: filtered }
}

export async function getServiceBySlug(slug: string): Promise<ServiceView | null> {
  const { services } = await getSupported()
  return services.find((s) => s.slug === slug) ?? null
}

export { CATEGORY_LABELS }
