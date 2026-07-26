import { describe, expect, it } from 'vitest'
import { extractMetadata } from './metadata'

const base = new URL('https://example.com/page')

describe('extractMetadata', () => {
  it('prefers og:title, falls back to <title>', () => {
    expect(
      extractMetadata('<title>Plain</title><meta property="og:title" content="OG Title">', base)
        .title,
    ).toBe('OG Title')
    expect(extractMetadata('<title>Plain</title>', base).title).toBe('Plain')
  })

  it('reads description from meta name or og', () => {
    expect(extractMetadata('<meta name="description" content="A page.">', base).description).toBe(
      'A page.',
    )
    expect(
      extractMetadata('<meta property="og:description" content="OG desc.">', base).description,
    ).toBe('OG desc.')
  })

  it('reads og:site_name', () => {
    expect(
      extractMetadata('<meta property="og:site_name" content="Example Co">', base).siteName,
    ).toBe('Example Co')
  })

  it('tolerates reversed attribute order', () => {
    expect(extractMetadata('<meta content="Reversed" property="og:title">', base).title).toBe(
      'Reversed',
    )
  })

  it('resolves a relative favicon to absolute', () => {
    expect(extractMetadata('<link rel="icon" href="/fav.png">', base).faviconUrl).toBe(
      'https://example.com/fav.png',
    )
  })

  it('falls back to /favicon.ico when no icon link', () => {
    expect(extractMetadata('<html></html>', base).faviconUrl).toBe(
      'https://example.com/favicon.ico',
    )
  })

  it('decodes HTML entities in the title', () => {
    expect(extractMetadata('<title>Tom &amp; Jerry &#39;24</title>', base).title).toBe(
      "Tom & Jerry '24",
    )
  })

  it('clamps an over-long description', () => {
    const long = 'x'.repeat(500)
    const out = extractMetadata(`<meta name="description" content="${long}">`, base).description!
    expect(out.length).toBeLessThanOrEqual(400)
    expect(out.endsWith('…')).toBe(true)
  })
})
