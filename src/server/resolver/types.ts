import type { ErrorCode } from '../../lib/errors'
import type { GuardedHttpClient } from '../../lib/net/http'
import type { Logger } from '../../lib/logger'

/** Service families. See docs/00-competitive-analysis.md §3. */
export type ServiceCategory = 'shortener' | 'paste' | 'ad-gate' | 'social-gate' | 'generic'

/** How a hop's destination was obtained. Shown in the chain. */
export type HopMethod =
  | 'redirect'
  | 'meta-refresh'
  | 'query-param'
  | 'base64-payload'
  | 'html-extract'
  | 'api'
  | 'terminal'

/** Context handed to every adapter. The http client is the ONLY egress path. */
export interface ResolveContext {
  readonly http: GuardedHttpClient
  readonly logger: Logger
  readonly signal: AbortSignal
  readonly depth: number
  readonly maxHops: number
  readonly visited: ReadonlySet<string>
  readonly requestId: string
}

/** The result of a single adapter hop. Exactly one edge in the resolution graph. */
export type AdapterResult =
  | { kind: 'next'; url: string; method: HopMethod; statusCode?: number; note?: string }
  | { kind: 'terminal'; url: string; method: HopMethod; statusCode?: number; note?: string }
  | { kind: 'skip'; reason: string }
  | { kind: 'error'; code: ErrorCode; message: string; statusCode?: number }

/** The plugin contract. See docs/06-resolver-engine.md §2. */
export interface ResolverAdapter {
  readonly id: string
  readonly name: string
  readonly category: ServiceCategory
  readonly hosts?: readonly string[]
  readonly priority?: number
  readonly listed?: boolean
  readonly description?: string
  /** Public status when the adapter is declared but not implemented. */
  readonly unavailable?: boolean

  /** Cheap predicate. No network I/O. */
  canHandle(url: URL, ctx: ResolveContext): boolean

  /** Perform one hop. */
  resolve(url: URL, ctx: ResolveContext): Promise<AdapterResult>
}

/** One step in the resolved chain, as returned to the client. */
export interface Hop {
  step: number
  url: string
  adapter: string | null
  method: HopMethod
  statusCode: number | null
  durationMs: number
}

export type ResolveStatus = 'resolved' | 'already-direct' | 'partial'

export interface ResolveOutcome {
  status: ResolveStatus
  source: string
  destination: string
  hops: number
  chain: Hop[]
  service: { id: string; name: string; category: ServiceCategory } | null
  warnings: string[]
  durationMs: number
}
