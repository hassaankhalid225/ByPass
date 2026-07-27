/** Client-facing shapes for the API. Safe to import from client components. */

export type HopMethod =
  | 'redirect'
  | 'meta-refresh'
  | 'query-param'
  | 'base64-payload'
  | 'html-extract'
  | 'api'
  | 'terminal'

export interface HopView {
  step: number
  url: string
  adapter: string | null
  method: HopMethod
  statusCode: number | null
  durationMs: number
}

export interface ResolveData {
  status: 'resolved' | 'already-direct' | 'partial'
  source: string
  destination: string
  hops: number
  cached: boolean
  durationMs: number
  resolvedAt: string
  service: { id: string; name: string; category: string } | null
  chain: HopView[]
  warnings: string[]
}

export interface PreviewData {
  url: string
  finalHost: string
  isHttps: boolean
  contentType: string | null
  title: string | null
  description: string | null
  siteName: string | null
  qr: string
  flags: string[]
  fetchedAt: string
}

export type BatchItemResult =
  | {
      input: string
      ok: true
      status: 'resolved' | 'already-direct' | 'partial'
      destination: string
      hops: number
      service: { id: string; name: string; category: string } | null
    }
  | { input: string; ok: false; code: string; message: string }

export interface BatchData {
  count: number
  results: BatchItemResult[]
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ApiEnvelope<T> =
  { ok: true; data: T; requestId: string } | { ok: false; error: ApiError; requestId: string }

/** Human-readable labels for hop methods, used in the route strip. */
export const METHOD_LABELS: Record<HopMethod, string> = {
  redirect: 'redirect',
  'meta-refresh': 'meta refresh',
  'query-param': 'wrapper param',
  'base64-payload': 'base64',
  'html-extract': 'page extract',
  api: 'api',
  terminal: 'destination',
}
