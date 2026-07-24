/**
 * URL normalisation. Runs before validation and before cache keying, so the same
 * link in different forms hits the same cache entry and the same guard result.
 */

/** Tracking params stripped during normalisation — they never change the destination. */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  '_ga',
  'ref_src',
  'ref_url',
])

export interface NormalizeResult {
  url: URL
  /** The canonical string form used as the cache key and stored (hashed). */
  href: string
}

/**
 * Normalise a user-supplied URL string.
 *  - assumes https:// when no scheme is present
 *  - lowercases scheme and host, converts unicode host to punycode (via URL)
 *  - strips tracking params and a trailing '?' / '#'
 * Throws a TypeError (from the URL constructor) if the input cannot be parsed;
 * callers translate that into an INVALID_URL app error.
 */
export function normalizeUrl(input: string): NormalizeResult {
  const trimmed = input.trim()
  if (trimmed.length === 0) throw new TypeError('empty url')

  // Add a scheme if the user pasted a bare host/path. Only when it looks like a
  // host (has a dot or is localhost-ish) to avoid turning garbage into a URL.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  const url = new URL(withScheme)

  // Scheme + host are already lowercased and punycoded by the URL parser.
  // Strip tracking params.
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
  }

  // Drop an empty query/hash for a stable canonical form.
  if ([...url.searchParams.keys()].length === 0) url.search = ''
  url.hash = ''

  return { url, href: url.toString() }
}
