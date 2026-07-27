import { isIP } from 'node:net'

/**
 * Lightweight, honest safety signals about a destination URL — computed from the
 * URL alone (no reputation service, no external call). These help a user judge a
 * link before opening it. They are advisories, not verdicts.
 */
export function computeSafetyFlags(url: URL): string[] {
  const flags: string[] = []

  if (url.protocol !== 'https:') {
    flags.push('Not served over HTTPS — data to this site is not encrypted.')
  }

  const host = url.hostname.replace(/\.$/, '')
  if (isIP(host) !== 0) {
    flags.push('Destination is a raw IP address, not a domain name.')
  }

  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    flags.push('Internationalized (punycode) domain — check the spelling carefully.')
  }

  if (url.username || url.password) {
    flags.push('URL contains embedded credentials.')
  }

  if (host.length > 40 && host.split('.').length > 4) {
    flags.push('Unusually long or deeply nested hostname.')
  }

  return flags
}
