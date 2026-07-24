import { logger } from '../../lib/logger'
import type { GuardedHttpClient, GuardedResponse } from '../../lib/net/http'
import type { ResolveContext } from './types'

/**
 * Test helpers. Adapters receive an injected `ctx.http`, so tests need no network.
 * See docs/06-resolver-engine.md §8.
 */

export interface CannedResponse {
  status: number
  headers?: Record<string, string>
  body?: string
}

export function redirectResponse(status: number, location: string): CannedResponse {
  return { status, headers: { location } }
}

export function htmlResponse(body: string, status = 200): CannedResponse {
  return { status, headers: { 'content-type': 'text/html; charset=utf-8' }, body }
}

export function textResponse(body: string, status = 200): CannedResponse {
  return { status, headers: { 'content-type': 'text/plain' }, body }
}

export interface TestContextOptions {
  responses?: Record<string, CannedResponse>
  signal?: AbortSignal
  depth?: number
  maxHops?: number
}

class FakeHttpClient implements GuardedHttpClient {
  constructor(private readonly responses: Record<string, CannedResponse>) {}

  async get(url: string | URL): Promise<GuardedResponse> {
    const key = url.toString()
    const canned = this.responses[key]
    if (!canned) {
      throw new Error(`FakeHttpClient: no canned response for ${key}`)
    }
    const headers = new Headers(canned.headers ?? {})
    return {
      status: canned.status,
      headers,
      url: key,
      text: async () => canned.body ?? '',
    }
  }
}

export function makeTestContext(options: TestContextOptions = {}): ResolveContext {
  return {
    http: new FakeHttpClient(options.responses ?? {}),
    logger,
    signal: options.signal ?? new AbortController().signal,
    depth: options.depth ?? 0,
    maxHops: options.maxHops ?? 10,
    visited: new Set<string>(),
    requestId: 'r_test',
  }
}

export { FakeHttpClient }
