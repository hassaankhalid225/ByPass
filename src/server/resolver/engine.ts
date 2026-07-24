import { env } from '../../lib/env'
import { AppError, errors } from '../../lib/errors'
import type { Logger } from '../../lib/logger'
import type { GuardedHttpClient } from '../../lib/net/http'
import { httpClient } from '../../lib/net/http'
import { validateOutboundUrl } from '../../lib/net/ssrf'
import type { Store } from '../store'
import { Breaker } from './breaker'
import { registry } from './registry'
import type {
  AdapterResult,
  Hop,
  ResolveContext,
  ResolveOutcome,
  ResolverAdapter,
  ResolveStatus,
} from './types'

/**
 * The resolution orchestrator. Walks the URL graph one hop at a time, enforcing
 * budgets, loop detection, and the circuit breaker, and returns an explainable
 * chain. See docs/02-architecture.md §3 and docs/06-resolver-engine.md §1.
 */

export interface EngineDeps {
  store: Store
  http?: GuardedHttpClient
  logger: Logger
  /** Source-URL validator. Defaults to the real SSRF guard; injectable for tests. */
  validateSource?: (url: URL) => Promise<void>
}

export interface ResolveRequest {
  /** Normalised source URL. */
  url: URL
  maxHops: number
  requestId: string
}

/** What a single hop attempt produced. */
type HopStep =
  | {
      kind: 'advanced'
      adapter: ResolverAdapter
      result: Extract<AdapterResult, { kind: 'next' | 'terminal' }>
      durationMs: number
    }
  | { kind: 'terminal-node' } // no adapter claims the url — it is the destination
  | {
      kind: 'error'
      adapter: ResolverAdapter
      result: Extract<AdapterResult, { kind: 'error' }>
      durationMs: number
    }

export class ResolverEngine {
  private readonly breaker: Breaker
  private readonly http: GuardedHttpClient
  private readonly validateSource: (url: URL) => Promise<void>

  constructor(private readonly deps: EngineDeps) {
    this.breaker = new Breaker(deps.store)
    this.http = deps.http ?? httpClient
    this.validateSource =
      deps.validateSource ?? (async (url) => void (await validateOutboundUrl(url)))
  }

  async resolve(req: ResolveRequest): Promise<ResolveOutcome> {
    const started = performance.now()

    // Validate the source up front for a clean BLOCKED_URL, before any walking.
    try {
      await this.validateSource(req.url)
    } catch (err) {
      if (AppError.is(err)) throw err
      throw new AppError('BLOCKED_URL', errors.blockedUrl().message, { cause: err })
    }

    const controller = new AbortController()
    const totalTimer = setTimeout(() => controller.abort(), env.RESOLVE_TIMEOUT_MS)

    const chain: Hop[] = []
    const warnings: string[] = []
    const visited = new Set<string>()

    let current = req.url
    let firstService: ResolveOutcome['service'] = null
    let status: ResolveStatus = 'already-direct'
    let terminated = false

    try {
      for (let depth = 0; depth < req.maxHops; depth += 1) {
        const key = current.toString()
        if (visited.has(key)) throw errors.loop()
        visited.add(key)

        if (controller.signal.aborted) {
          warnings.push('Resolution timed out; showing the furthest hop reached.')
          status = 'partial'
          terminated = true
          break
        }

        const ctx = this.contextFor(controller.signal, depth, req, visited)
        const step = await this.stepOnce(current, ctx)

        if (step.kind === 'terminal-node') {
          // No adapter claims this url — it is the destination.
          if (depth === 0) status = 'already-direct'
          terminated = true
          break
        }

        if (step.kind === 'error') {
          chain.push({
            step: chain.length + 1,
            url: current.toString(),
            adapter: step.adapter.id,
            method: 'terminal',
            statusCode: step.result.statusCode ?? null,
            durationMs: step.durationMs,
          })
          throw new AppError(step.result.code, step.result.message)
        }

        // advanced
        if (depth === 0) firstService = serviceOf(step.adapter)
        status = 'resolved'
        current = pushHop(chain, current, step.adapter, step.result, step.durationMs)
        if (step.result.kind === 'terminal') {
          terminated = true
          break
        }
      }

      // The loop ran to its hop budget while still advancing — the chain did not
      // terminate within maxHops.
      if (!terminated && status === 'resolved') {
        throw errors.maxHops()
      }
    } finally {
      clearTimeout(totalTimer)
    }

    return finalize(req, current, chain, warnings, status, firstService, started)
  }

  private contextFor(
    signal: AbortSignal,
    depth: number,
    req: ResolveRequest,
    visited: Set<string>,
  ): ResolveContext {
    return {
      http: this.http,
      logger: this.deps.logger,
      signal,
      depth,
      maxHops: req.maxHops,
      visited,
      requestId: req.requestId,
    }
  }

  /**
   * Try each candidate adapter in order until one advances, errors, or the list is
   * exhausted (a `skip` moves to the next candidate). Candidates are host-specific
   * first, then the priority-sorted generic chain.
   */
  private async stepOnce(url: URL, ctx: ResolveContext): Promise<HopStep> {
    for (const adapter of registry.candidatesFor(url)) {
      if (!adapter.canHandle(url, ctx)) continue
      const decision = await this.breaker.check(adapter.id)
      if (!decision.allowed) continue

      const hopStart = performance.now()
      const result = await this.runAdapter(adapter, url, {
        ...ctx,
        logger: ctx.logger.child({ adapterId: adapter.id }),
      })
      const durationMs = Math.round(performance.now() - hopStart)

      if (result.kind === 'skip') continue
      if (result.kind === 'error') return { kind: 'error', adapter, result, durationMs }
      return { kind: 'advanced', adapter, result, durationMs }
    }
    return { kind: 'terminal-node' }
  }

  /** Run an adapter and update the breaker based on the outcome. */
  private async runAdapter(
    adapter: ResolverAdapter,
    url: URL,
    ctx: ResolveContext,
  ): Promise<AdapterResult> {
    let result: AdapterResult
    try {
      result = await adapter.resolve(url, ctx)
    } catch (err) {
      ctx.logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'adapter threw')
      await this.breaker.recordFailure(adapter.id)
      if (AppError.is(err)) return { kind: 'error', code: err.code, message: err.message }
      return { kind: 'error', code: 'INTERNAL_ERROR', message: 'adapter failed' }
    }

    if (result.kind === 'error') {
      if (result.code !== 'BLOCKED_URL' && result.code !== 'VALIDATION_ERROR') {
        await this.breaker.recordFailure(adapter.id)
      }
    } else if (result.kind === 'next' || result.kind === 'terminal') {
      await this.breaker.recordSuccess(adapter.id)
    }
    return result
  }
}

function serviceOf(adapter: ResolverAdapter): ResolveOutcome['service'] {
  return { id: adapter.id, name: adapter.name, category: adapter.category }
}

function pushHop(
  chain: Hop[],
  from: URL,
  adapter: ResolverAdapter,
  result: Extract<AdapterResult, { kind: 'next' | 'terminal' }>,
  durationMs: number,
): URL {
  chain.push({
    step: chain.length + 1,
    url: from.toString(),
    adapter: adapter.id,
    method: result.method,
    statusCode: result.statusCode ?? null,
    durationMs,
  })
  return new URL(result.url)
}

function finalize(
  req: ResolveRequest,
  current: URL,
  chain: Hop[],
  warnings: string[],
  status: ResolveStatus,
  firstService: ResolveOutcome['service'],
  started: number,
): ResolveOutcome {
  const destination = current.toString()

  // Ensure the destination is the last entry in the chain.
  const last = chain[chain.length - 1]
  if (!last) {
    chain.push({
      step: 1,
      url: destination,
      adapter: null,
      method: 'terminal',
      statusCode: null,
      durationMs: 0,
    })
  } else if (last.method !== 'terminal' && last.url !== destination) {
    chain.push({
      step: chain.length + 1,
      url: destination,
      adapter: null,
      method: 'terminal',
      statusCode: null,
      durationMs: 0,
    })
  }

  return {
    status,
    source: req.url.toString(),
    destination,
    hops: chain.length,
    chain,
    service: firstService,
    warnings,
    durationMs: Math.round(performance.now() - started),
  }
}
