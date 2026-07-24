import type {
  AdapterHealth,
  AdapterStateRow,
  ResolutionRecord,
  Store,
  SystemSummary,
} from './types'

/**
 * In-memory store: a bounded ring buffer of resolution records plus a map of
 * adapter state. The fallback when DATABASE_URL is unset, and the default in dev
 * and test. Health and metrics work; they reset with the process and are
 * per-instance (ADR-0004).
 */

const MAX_RECORDS = 10000
const cutoffMs = 24 * 60 * 60 * 1000

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]!
}

export class MemoryStore implements Store {
  readonly name = 'memory' as const
  private records: ResolutionRecord[] = []
  private state = new Map<string, AdapterStateRow>()

  async ready(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 }
  }

  async recordResolution(record: ResolutionRecord): Promise<void> {
    this.records.push(record)
    if (this.records.length > MAX_RECORDS) this.records.shift()
  }

  private recent(): ResolutionRecord[] {
    const cutoff = Date.now() - cutoffMs
    return this.records.filter((r) => r.createdAt.getTime() > cutoff)
  }

  async adapterHealth24h(): Promise<AdapterHealth[]> {
    const byAdapter = new Map<string, ResolutionRecord[]>()
    for (const r of this.recent()) {
      if (!r.adapterId) continue
      const list = byAdapter.get(r.adapterId) ?? []
      list.push(r)
      byAdapter.set(r.adapterId, list)
    }

    const out: AdapterHealth[] = []
    for (const [adapterId, list] of byAdapter) {
      const successes = list.filter(
        (r) => r.status === 'resolved' || r.status === 'already-direct',
      ).length
      const durations = list.map((r) => r.durationMs)
      out.push({
        adapterId,
        samples: list.length,
        successes,
        successRate: list.length ? Number((successes / list.length).toFixed(4)) : null,
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        lastSeenAt: list.reduce<Date | null>(
          (max, r) => (!max || r.createdAt > max ? r.createdAt : max),
          null,
        ),
      })
    }
    return out.sort((a, b) => a.adapterId.localeCompare(b.adapterId))
  }

  async systemSummary24h(): Promise<SystemSummary> {
    const recent = this.recent()
    if (recent.length === 0) {
      return { resolutions: 0, successRate: null, p50Ms: null, p95Ms: null, cacheHitRate: null }
    }
    const successes = recent.filter(
      (r) => r.status === 'resolved' || r.status === 'already-direct',
    ).length
    const cached = recent.filter((r) => r.cached).length
    const durations = recent.map((r) => r.durationMs)
    return {
      resolutions: recent.length,
      successRate: Number((successes / recent.length).toFixed(4)),
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      cacheHitRate: Number((cached / recent.length).toFixed(4)),
    }
  }

  async getAdapterState(adapterId: string): Promise<AdapterStateRow | null> {
    return this.state.get(adapterId) ?? null
  }

  async listAdapterState(): Promise<AdapterStateRow[]> {
    return [...this.state.values()].sort((a, b) => a.adapterId.localeCompare(b.adapterId))
  }

  async upsertAdapterState(
    adapterId: string,
    patch: Partial<Omit<AdapterStateRow, 'adapterId' | 'updatedAt'>>,
  ): Promise<AdapterStateRow> {
    const existing: AdapterStateRow = this.state.get(adapterId) ?? {
      adapterId,
      enabled: true,
      breakerState: 'closed',
      consecutiveFailures: 0,
      openedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      note: null,
      updatedAt: new Date(),
    }
    const next: AdapterStateRow = { ...existing, ...patch, adapterId, updatedAt: new Date() }
    this.state.set(adapterId, next)
    return next
  }
}
