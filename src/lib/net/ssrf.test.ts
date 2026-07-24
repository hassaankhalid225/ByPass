import { describe, expect, it } from 'vitest'
import { SsrfError, isPlausiblyFetchable, validateOutboundUrl } from './ssrf'

/**
 * The security spec as executable tests. A change to the guard that does not update
 * these fails CI. See docs/07-security.md §2.6.
 */

async function expectBlocked(url: string): Promise<void> {
  await expect(validateOutboundUrl(url), `${url} should be blocked`).rejects.toBeInstanceOf(
    SsrfError,
  )
}

describe('validateOutboundUrl — scheme allowlist', () => {
  it.each([
    'file:///etc/passwd',
    'gopher://127.0.0.1',
    'ftp://example.com',
    'data:text/plain,hi',
    'dict://localhost',
    'ldap://localhost',
  ])('blocks scheme %s', async (url) => {
    await expectBlocked(url)
  })
})

describe('validateOutboundUrl — host shape', () => {
  it.each([
    'http://localhost/',
    'http://localhost.',
    'http://foo.local/',
    'http://foo.internal/',
    'http://something.onion/',
    'http://user:pass@example.com/',
    'http://spoofed.example.com@127.0.0.1/',
    'http://nodothost/',
  ])('blocks host %s', async (url) => {
    await expectBlocked(url)
  })
})

describe('validateOutboundUrl — literal IP bypasses', () => {
  it.each([
    'http://127.0.0.1/',
    'http://127.1/', // rejected as non-canonical / single-checked
    'http://2130706433/', // decimal 127.0.0.1
    'http://0x7f.0.0.1/', // hex
    'http://0177.0.0.1/', // octal
    'http://[::1]/', // ipv6 loopback
    'http://[::ffff:127.0.0.1]/', // ipv4-mapped
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://10.0.0.1/',
    'http://192.168.0.1/',
    'http://172.16.0.1/',
  ])('blocks %s', async (url) => {
    await expectBlocked(url)
  })
})

describe('validateOutboundUrl — ports', () => {
  it('blocks a non-standard port', async () => {
    await expectBlocked('http://example.com:22/')
    await expectBlocked('http://example.com:5432/')
  })
})

describe('isPlausiblyFetchable', () => {
  it('accepts http(s) and rejects others', () => {
    expect(isPlausiblyFetchable('https://example.com')).toBe(true)
    expect(isPlausiblyFetchable('http://example.com')).toBe(true)
    expect(isPlausiblyFetchable('file:///x')).toBe(false)
    expect(isPlausiblyFetchable('not a url')).toBe(false)
  })
})

describe('validateOutboundUrl — public literal IP', () => {
  it('allows a public IP literal without a DNS lookup', async () => {
    const result = await validateOutboundUrl('https://1.1.1.1/')
    expect(result.address).toBe('1.1.1.1')
    expect(result.family).toBe(4)
    expect(result.port).toBe(443)
  })
})
