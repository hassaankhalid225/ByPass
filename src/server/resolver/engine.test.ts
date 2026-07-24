import { describe, expect, it } from 'vitest'
import { logger } from '../../lib/logger'
import { AppError, errors } from '../../lib/errors'
import { MemoryStore } from '../store'
import { ResolverEngine } from './engine'
import { FakeHttpClient } from './testing'

/**
 * A deterministic, offline source validator: blocks obvious private literals so the
 * BLOCKED_URL path is still exercised, but allows test domains without a DNS lookup.
 */
async function testValidateSource(url: URL): Promise<void> {
  const host = url.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') || host === '::1') {
    throw errors.blockedUrl()
  }
}

function makeEngine(
  responses: Record<string, { status: number; headers?: Record<string, string>; body?: string }>,
) {
  const http = new FakeHttpClient(responses)
  return new ResolverEngine({
    store: new MemoryStore(),
    http,
    logger,
    validateSource: testValidateSource,
  })
}

const req = (url: string, maxHops = 10) => ({
  url: new URL(url),
  maxHops,
  requestId: 'r_test',
})

describe('ResolverEngine', () => {
  it('resolves a multi-hop chain to the destination', async () => {
    const engine = makeEngine({
      'https://bit.ly/abc': {
        status: 301,
        headers: { location: 'https://mid.test/go?url=https://dest.test/final' },
      },
      // The final page: http-redirect fetches it, finds no redirect, and terminates.
      'https://dest.test/final': {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<html>done</html>',
      },
    })
    const out = await engine.resolve(req('https://bit.ly/abc'))
    expect(out.status).toBe('resolved')
    expect(out.destination).toBe('https://dest.test/final')
    // bit.ly redirect -> params-resolver extracts the wrapper -> terminal
    expect(out.chain.length).toBeGreaterThanOrEqual(2)
    expect(out.chain[out.chain.length - 1]?.url).toBe('https://dest.test/final')
  })

  it('reports already-direct for a plain destination', async () => {
    const engine = makeEngine({
      'https://dest.test/x': {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<html>ok</html>',
      },
    })
    const out = await engine.resolve(req('https://dest.test/x'))
    expect(out.status).toBe('already-direct')
    expect(out.destination).toBe('https://dest.test/x')
    expect(out.chain).toHaveLength(1)
  })

  it('detects a redirect loop', async () => {
    const engine = makeEngine({
      'https://a.test/': { status: 302, headers: { location: 'https://b.test/' } },
      'https://b.test/': { status: 302, headers: { location: 'https://a.test/' } },
    })
    await expect(engine.resolve(req('https://a.test/'))).rejects.toMatchObject({
      code: 'LOOP_DETECTED',
    })
  })

  it('enforces max hops', async () => {
    const engine = makeEngine({
      'https://a.test/': { status: 302, headers: { location: 'https://b.test/' } },
      'https://b.test/': { status: 302, headers: { location: 'https://c.test/' } },
      'https://c.test/': { status: 302, headers: { location: 'https://d.test/' } },
    })
    await expect(engine.resolve(req('https://a.test/', 2))).rejects.toBeInstanceOf(AppError)
  })

  it('blocks a source that points to a private address', async () => {
    const engine = makeEngine({})
    await expect(engine.resolve(req('http://127.0.0.1/'))).rejects.toMatchObject({
      code: 'BLOCKED_URL',
    })
  })
})
