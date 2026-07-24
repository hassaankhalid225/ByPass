import { gateAdapters } from './adapters/gates'
import { genericAdapters } from './adapters/generic'
import { pasteAdapters } from './adapters/paste'
import { shortenerAdapters } from './adapters/shorteners'
import type { ResolverAdapter } from './types'

/**
 * The adapter registry. Maintains a host index for O(1) host-based lookup and a
 * priority-sorted generic chain for capability-based fallback. Selection tries the
 * host index first (a specific answer beats a general one), then the generic chain.
 * See docs/06-resolver-engine.md §4.
 */

// Order matters only for registration tie-breaks; priority dominates.
const ALL_ADAPTERS: ResolverAdapter[] = [
  ...shortenerAdapters,
  ...pasteAdapters,
  ...gateAdapters,
  ...genericAdapters,
]

class Registry {
  private readonly byId = new Map<string, ResolverAdapter>()
  private readonly hostIndex = new Map<string, ResolverAdapter[]>()
  private readonly genericChain: ResolverAdapter[] = []
  private readonly registrationOrder = new Map<string, number>()

  constructor(adapters: ResolverAdapter[]) {
    adapters.forEach((adapter, i) => {
      if (this.byId.has(adapter.id)) {
        throw new Error(`Duplicate adapter id: ${adapter.id}`)
      }
      if (!/^[a-z0-9-]{2,32}$/.test(adapter.id)) {
        throw new Error(`Adapter id must match ^[a-z0-9-]{2,32}$: ${adapter.id}`)
      }
      this.byId.set(adapter.id, adapter)
      this.registrationOrder.set(adapter.id, i)

      if (adapter.hosts && adapter.hosts.length > 0) {
        for (const host of adapter.hosts) {
          const list = this.hostIndex.get(host) ?? []
          list.push(adapter)
          this.hostIndex.set(host, list)
        }
      } else {
        this.genericChain.push(adapter)
      }
    })

    // Sort generic chain by priority desc, then registration order.
    this.genericChain.sort((a, b) => this.compare(a, b))
    // Sort each host bucket the same way.
    for (const list of this.hostIndex.values()) list.sort((a, b) => this.compare(a, b))
  }

  private compare(a: ResolverAdapter, b: ResolverAdapter): number {
    const pa = a.priority ?? 0
    const pb = b.priority ?? 0
    if (pa !== pb) return pb - pa
    return this.registrationOrder.get(a.id)! - this.registrationOrder.get(b.id)!
  }

  get(id: string): ResolverAdapter | undefined {
    return this.byId.get(id)
  }

  all(): ResolverAdapter[] {
    return [...this.byId.values()]
  }

  /** Adapters shown on /supported, in a stable display order. */
  listed(): ResolverAdapter[] {
    return this.all()
      .filter((a) => a.listed !== false)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Ordered list of candidate adapters for a URL: host-declared adapters (by
   * increasingly-general parent domain) first, then the generic chain.
   */
  candidatesFor(url: URL): ResolverAdapter[] {
    const seen = new Set<string>()
    const out: ResolverAdapter[] = []

    for (const host of hostChain(url.hostname)) {
      for (const adapter of this.hostIndex.get(host) ?? []) {
        if (!seen.has(adapter.id)) {
          seen.add(adapter.id)
          out.push(adapter)
        }
      }
    }
    for (const adapter of this.genericChain) {
      if (!seen.has(adapter.id)) {
        seen.add(adapter.id)
        out.push(adapter)
      }
    }
    return out
  }
}

/** example: a.b.example.com -> [a.b.example.com, b.example.com, example.com] */
export function hostChain(hostname: string): string[] {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  const parts = host.split('.')
  const chain: string[] = []
  for (let i = 0; i < parts.length - 1; i += 1) {
    chain.push(parts.slice(i).join('.'))
  }
  if (chain.length === 0) chain.push(host)
  return chain
}

export const registry = new Registry(ALL_ADAPTERS)
export type { ResolverAdapter }
