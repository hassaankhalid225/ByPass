/** Persistence contract. Two drivers: PostgreSQL and an in-memory ring buffer. */

export type ResolutionStatus = 'resolved' | 'already-direct' | 'partial' | 'failed'

export interface ResolutionRecord {
  requestId: string
  /** Salted SHA-256 of the normalised source URL — never the raw URL. */
  sourceHash: string
  sourceHost: string
  destinationHost: string | null
  adapterId: string | null
  category: string | null
  status: ResolutionStatus
  errorCode: string | null
  hops: number
  durationMs: number
  cached: boolean
  /** Salted SHA-256 of the client IP, or null. */
  clientHash: string | null
  /** Hop array with URLs already stripped to host + method + status. */
  chain: unknown
  createdAt: Date
}

export interface AdapterHealth {
  adapterId: string
  samples: number
  successes: number
  successRate: number | null
  p50Ms: number | null
  p95Ms: number | null
  lastSeenAt: Date | null
}

export interface SystemSummary {
  resolutions: number
  successRate: number | null
  p50Ms: number | null
  p95Ms: number | null
  cacheHitRate: number | null
}

export interface AdapterStateRow {
  adapterId: string
  enabled: boolean
  breakerState: 'closed' | 'open' | 'half-open'
  consecutiveFailures: number
  openedAt: Date | null
  lastSuccessAt: Date | null
  lastFailureAt: Date | null
  note: string | null
  updatedAt: Date
}

export interface Store {
  readonly name: 'postgres' | 'memory'
  ready(): Promise<{ ok: boolean; latencyMs: number }>

  recordResolution(record: ResolutionRecord): Promise<void>

  adapterHealth24h(): Promise<AdapterHealth[]>
  systemSummary24h(): Promise<SystemSummary>

  getAdapterState(adapterId: string): Promise<AdapterStateRow | null>
  listAdapterState(): Promise<AdapterStateRow[]>
  upsertAdapterState(
    adapterId: string,
    patch: Partial<Omit<AdapterStateRow, 'adapterId' | 'updatedAt'>>,
  ): Promise<AdapterStateRow>
}
