import { describe, expect, it } from 'vitest'
import { makeTestContext, redirectResponse, htmlResponse } from '../testing'
import { baseResolver, httpRedirect, paramsResolver } from './generic'

describe('params-resolver', () => {
  it('claims and resolves a wrapper param', async () => {
    const url = new URL('https://w.co/go?url=https://dest.test/a')
    const ctx = makeTestContext()
    expect(paramsResolver.canHandle(url, ctx)).toBe(true)
    const out = await paramsResolver.resolve(url, ctx)
    expect(out).toEqual({ kind: 'next', url: 'https://dest.test/a', method: 'query-param' })
  })

  it('declines a url without a wrapper param', () => {
    expect(paramsResolver.canHandle(new URL('https://w.co/plain'), makeTestContext())).toBe(false)
  })
})

describe('base-resolver', () => {
  it('decodes a base64 path payload', async () => {
    const encoded = Buffer.from('https://dest.test/b').toString('base64')
    const url = new URL(`https://w.co/${encoded}`)
    const out = await baseResolver.resolve(url, makeTestContext())
    expect(out).toEqual({ kind: 'next', url: 'https://dest.test/b', method: 'base64-payload' })
  })
})

describe('http-redirect', () => {
  it('follows a Location header', async () => {
    const url = new URL('https://short.test/abc')
    const ctx = makeTestContext({
      responses: { 'https://short.test/abc': redirectResponse(301, 'https://dest.test/final') },
    })
    const out = await httpRedirect.resolve(url, ctx)
    expect(out).toEqual({
      kind: 'next',
      url: 'https://dest.test/final',
      method: 'redirect',
      statusCode: 301,
    })
  })

  it('resolves a relative Location against the base', async () => {
    const url = new URL('https://short.test/abc')
    const ctx = makeTestContext({
      responses: { 'https://short.test/abc': redirectResponse(302, '/landing') },
    })
    const out = await httpRedirect.resolve(url, ctx)
    expect(out).toMatchObject({ kind: 'next', url: 'https://short.test/landing' })
  })

  it('falls back to meta-refresh on a 200 interstitial', async () => {
    const url = new URL('https://short.test/abc')
    const ctx = makeTestContext({
      responses: {
        'https://short.test/abc': htmlResponse(
          '<meta http-equiv="refresh" content="0;url=https://dest.test/meta">',
        ),
      },
    })
    const out = await httpRedirect.resolve(url, ctx)
    expect(out).toMatchObject({
      kind: 'next',
      url: 'https://dest.test/meta',
      method: 'meta-refresh',
    })
  })

  it('skips when there is nothing to follow', async () => {
    const url = new URL('https://dest.test/final')
    const ctx = makeTestContext({
      responses: { 'https://dest.test/final': htmlResponse('<html>done</html>') },
    })
    const out = await httpRedirect.resolve(url, ctx)
    expect(out.kind).toBe('skip')
  })
})
