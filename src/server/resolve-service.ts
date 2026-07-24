import { env } from '../lib/env'
import { AppError } from '../lib/errors'
import { saltedHash } from '../lib/hash'
import { requestLogger, safeUrl } from '../lib/logger'
import { normalizeUrl } from '../lib/url/normalize'
import { getCache } from './cache'
import { metrics } from './metrics'
import { ResolverEngine } from './resolver'
import type { Hop, ResolveOutcome } from './resolver'
import { getStore } from './store'
import type { ResolutionRecord, ResolutionStatus } from './store'

/**
 * The application service for resolving a link. Ties the engine to the cache, the
 * store, normalisation, and metrics — the one place a route handler calls. Keeps
 * the transport layer free of business logic (docs/02-architecture.md §2).
 */

const CACHE_PREFIX = 'resolve:v1:'

export interface ResolveInput {
  rawUrl: string
  maxHops: number
  noCache: boolean
  includeChain: boolean
  requestId: string
  clientId: string | null
}

export interface ResolveServiceResult extends ResolveOutcome {
  cached: boolean
  resolvedAt: string
}

export async function resolveLink(input: ResolveInput): Promise<ResolveServiceResult> {
  const log = requestLogger(input.requestId)

  // Normalise (throws TypeError on unparseable input -> INVALID_URL upstream).
  let normalized
  try {
    normalized = normalizeUrl(input.rawUrl)
  } catch {
    throw new AppError('INVALID_URL', 'That does not look like a valid URL.')
  }

  const cacheKey = CACHE_PREFIX + saltedHash(normalized.href)
  const cache = await getCache()
  const store = await getStore()

  // Cache read.
  if (!input.noCache) {
    const hit = await cache.get<ResolveServiceResult>(cacheKey)
    if (hit) {
      metrics.recordCache('hit')
      log.info({ url: safeUrl(normalized.href), cached: true }, 'resolve cache hit')
      return trimChain({ ...hit, cached: true }, input.includeChain)
    }
  }
  metrics.recordCache('miss')

  const engine = new ResolverEngine({ store, logger: log })

  let outcome: ResolveOutcome
  try {
    outcome = await engine.resolve({
      url: normalized.url,
      maxHops: Math.min(input.maxHops, env.MAX_HOPS),
      requestId: input.requestId,
    })
  } catch (err) {
    const code = AppError.is(err) ? err.code : 'INTERNAL_ERROR'
    metrics.recordResolve('failure', 0)
    await persistFailure(store, input, normalized.href, code).catch((e) =>
      log.warn({ err: describe(e) }, 'failed to persist resolution failure'),
    )
    throw err
  }

  const result: ResolveServiceResult = {
    ...outcome,
    cached: false,
    resolvedAt: new Date().toISOString(),
  }

  // Metrics.
  metrics.recordResolve('success', outcome.durationMs)
  if (outcome.service) metrics.recordAdapter(outcome.service.id, 'success')

  // Cache write (TTL by outcome).
  const ttl = env.CACHE_TTL_SUCCESS_S
  await cache
    .set(cacheKey, result, ttl)
    .catch((e) => log.warn({ err: describe(e) }, 'cache write failed'))

  // Persist (best-effort; never blocks the response on a slow store failure).
  await persistSuccess(store, input, normalized, outcome).catch((e) =>
    log.warn({ err: describe(e) }, 'failed to persist resolution'),
  )

  log.info(
    {
      url: safeUrl(normalized.href),
      status: outcome.status,
      hops: outcome.hops,
      durationMs: outcome.durationMs,
    },
    'resolved',
  )

  return trimChain(result, input.includeChain)
}

function trimChain(result: ResolveServiceResult, includeChain: boolean): ResolveServiceResult {
  if (includeChain) return result
  return { ...result, chain: [] }
}

async function persistSuccess(
  store: Awaited<ReturnType<typeof getStore>>,
  input: ResolveInput,
  normalized: { url: URL; href: string },
  outcome: ResolveOutcome,
): Promise<void> {
  const record: ResolutionRecord = {
    requestId: input.requestId,
    sourceHash: saltedHash(normalized.href),
    sourceHost: normalized.url.hostname,
    destinationHost: hostOf(outcome.destination),
    adapterId: outcome.service?.id ?? null,
    category: outcome.service?.category ?? null,
    status: outcome.status as ResolutionStatus,
    errorCode: null,
    hops: outcome.hops,
    durationMs: outcome.durationMs,
    cached: false,
    clientHash: input.clientId ? saltedHash(input.clientId) : null,
    chain: stripChainUrls(outcome.chain),
    createdAt: new Date(),
  }
  await store.recordResolution(record)
}

async function persistFailure(
  store: Awaited<ReturnType<typeof getStore>>,
  input: ResolveInput,
  href: string,
  errorCode: string,
): Promise<void> {
  let host = 'unknown'
  try {
    host = new URL(href).hostname
  } catch {
    /* ignore */
  }
  await store.recordResolution({
    requestId: input.requestId,
    sourceHash: saltedHash(href),
    sourceHost: host,
    destinationHost: null,
    adapterId: null,
    category: null,
    status: 'failed',
    errorCode,
    hops: 0,
    durationMs: 0,
    cached: false,
    clientHash: input.clientId ? saltedHash(input.clientId) : null,
    chain: null,
    createdAt: new Date(),
  })
}

/** Strip full URLs from the chain before storage — keep host + method + status. */
function stripChainUrls(chain: Hop[]): unknown {
  return chain.map((hop) => ({
    step: hop.step,
    host: hostOf(hop.url),
    adapter: hop.adapter,
    method: hop.method,
    statusCode: hop.statusCode,
    durationMs: hop.durationMs,
  }))
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown'
}
