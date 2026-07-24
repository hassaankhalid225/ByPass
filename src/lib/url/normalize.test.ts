import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './normalize'

describe('normalizeUrl', () => {
  it('assumes https when no scheme is present', () => {
    expect(normalizeUrl('example.com/x').href).toBe('https://example.com/x')
  })

  it('lowercases the host', () => {
    expect(normalizeUrl('https://EXAMPLE.com/Path').href).toBe('https://example.com/Path')
  })

  it('strips tracking params but keeps others', () => {
    const { href } = normalizeUrl('https://x.test/a?utm_source=z&id=5&fbclid=abc')
    expect(href).toBe('https://x.test/a?id=5')
  })

  it('drops an empty query and hash', () => {
    expect(normalizeUrl('https://x.test/a?#frag').href).toBe('https://x.test/a')
  })

  it('throws on empty input', () => {
    expect(() => normalizeUrl('   ')).toThrow()
  })

  it('converts a unicode host to punycode', () => {
    expect(normalizeUrl('https://bücher.example/x').href).toContain('xn--')
  })
})
