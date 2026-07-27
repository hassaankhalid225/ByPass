import { describe, expect, it } from 'vitest'
import { computeSafetyFlags } from './safety'

describe('computeSafetyFlags', () => {
  it('is empty for a clean https domain', () => {
    expect(computeSafetyFlags(new URL('https://example.com/path'))).toEqual([])
  })

  it('flags non-https', () => {
    expect(computeSafetyFlags(new URL('http://example.com/'))[0]).toMatch(/HTTPS/)
  })

  it('flags a raw IP host', () => {
    expect(computeSafetyFlags(new URL('https://93.184.216.34/'))).toContainEqual(
      expect.stringMatching(/raw IP/),
    )
  })

  it('flags a punycode domain', () => {
    expect(computeSafetyFlags(new URL('https://xn--80ak6aa92e.com/'))).toContainEqual(
      expect.stringMatching(/punycode/i),
    )
  })

  it('flags embedded credentials', () => {
    expect(computeSafetyFlags(new URL('https://user:pass@example.com/'))).toContainEqual(
      expect.stringMatching(/credentials/i),
    )
  })
})
