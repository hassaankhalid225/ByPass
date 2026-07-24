import { describe, expect, it } from 'vitest'
import {
  extractBase64Url,
  extractCanonical,
  extractFirstUrl,
  extractJsLocation,
  extractMetaRefresh,
  extractWrapperParam,
  isAbsoluteHttpUrl,
} from './extract'

describe('extractFirstUrl', () => {
  it('finds a url in prose and trims trailing punctuation', () => {
    expect(extractFirstUrl('see https://example.com/x.')).toBe('https://example.com/x')
    expect(extractFirstUrl('no url here')).toBeNull()
  })
})

describe('extractWrapperParam', () => {
  it('extracts a url from known wrapper params', () => {
    expect(extractWrapperParam(new URL('https://w.co/go?url=https://dest.test/a'))).toBe(
      'https://dest.test/a',
    )
    expect(extractWrapperParam(new URL('https://w.co/go?to=https%3A%2F%2Fdest.test%2Fb'))).toBe(
      'https://dest.test/b',
    )
  })

  it('ignores non-url params', () => {
    expect(extractWrapperParam(new URL('https://w.co/go?url=notaurl'))).toBeNull()
    expect(extractWrapperParam(new URL('https://w.co/go?x=1'))).toBeNull()
  })
})

describe('extractMetaRefresh', () => {
  it('parses a meta refresh target', () => {
    const html = '<meta http-equiv="refresh" content="0; url=https://dest.test/z">'
    expect(extractMetaRefresh(html)).toBe('https://dest.test/z')
  })
  it('returns null without a url', () => {
    expect(extractMetaRefresh('<meta http-equiv="refresh" content="5">')).toBeNull()
  })
})

describe('extractCanonical', () => {
  it('parses a canonical link', () => {
    const html = '<link rel="canonical" href="https://dest.test/canonical">'
    expect(extractCanonical(html)).toBe('https://dest.test/canonical')
  })
})

describe('extractJsLocation', () => {
  it('reads a literal location assignment', () => {
    expect(extractJsLocation('<script>window.location="https://dest.test/js"</script>')).toBe(
      'https://dest.test/js',
    )
    expect(extractJsLocation('<script>location.replace("https://dest.test/r")</script>')).toBe(
      'https://dest.test/r',
    )
  })
  it('ignores dynamic expressions', () => {
    expect(extractJsLocation('<script>location.href = someVar</script>')).toBeNull()
  })
})

describe('extractBase64Url', () => {
  it('decodes a base64 payload in the path', () => {
    const encoded = Buffer.from('https://dest.test/b64').toString('base64')
    expect(extractBase64Url(new URL(`https://w.co/${encoded}`))).toBe('https://dest.test/b64')
  })
  it('decodes a base64url payload in a query value', () => {
    const encoded = Buffer.from('https://dest.test/x?a=1').toString('base64url')
    expect(extractBase64Url(new URL(`https://w.co/go?d=${encoded}`))).toBe(
      'https://dest.test/x?a=1',
    )
  })
  it('ignores non-base64 or non-url decodes', () => {
    expect(extractBase64Url(new URL('https://w.co/plainpath'))).toBeNull()
  })
})

describe('isAbsoluteHttpUrl', () => {
  it('accepts http/https only', () => {
    expect(isAbsoluteHttpUrl('https://x.test')).toBe(true)
    expect(isAbsoluteHttpUrl('http://x.test')).toBe(true)
    expect(isAbsoluteHttpUrl('ftp://x.test')).toBe(false)
    expect(isAbsoluteHttpUrl('/relative')).toBe(false)
  })
})
