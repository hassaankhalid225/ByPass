import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { env } from '../env'
import { classifyIp, parseIpv4 } from './ip'

/**
 * SSRF guard — the single most important file in the repository.
 *
 * Defence in depth, five layers, all mandatory, none bypassable from an adapter:
 *   1. scheme allowlist
 *   2. host shape validation
 *   3. DNS resolution + IP-range checks on EVERY resolved address
 *   4. DNS-rebinding defence: the validated IP is the IP that gets connected to
 *   5. redirects re-enter this guard from scratch
 *
 * See docs/07-security.md §2. The guarded HTTP client (./http.ts) is the only
 * thing that calls this, and it is the only egress path in the system.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set<number>([80, 443, ...env.EXTRA_ALLOWED_PORTS])

// Special-use TLDs and hostnames that must never resolve outbound.
const BLOCKED_TLDS = ['.local', '.localhost', '.internal', '.home.arpa', '.onion', '.test']
const BLOCKED_EXACT = new Set(['localhost', 'ip6-localhost', 'ip6-loopback'])

export interface ValidatedTarget {
  /** The original, validated URL. */
  url: URL
  /** The literal IP to connect to (rebinding defence). */
  address: string
  /** 4 or 6. */
  family: number
  /** The hostname for the Host header and TLS SNI. */
  hostname: string
  port: number
}

export class SsrfError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(`Blocked by SSRF guard: ${reason}`)
    this.name = 'SsrfError'
    this.reason = reason
  }
}

/**
 * Validate a URL for outbound fetching and resolve it to a concrete, safe IP.
 * Throws SsrfError on any violation. On success the caller MUST connect to
 * `address` (not re-resolve `hostname`) to preserve the rebinding defence.
 */
export async function validateOutboundUrl(input: string | URL): Promise<ValidatedTarget> {
  // Layer 1 — scheme.
  let url: URL
  try {
    url = typeof input === 'string' ? new URL(input) : input
  } catch {
    throw new SsrfError('unparseable url')
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) throw new SsrfError(`scheme ${url.protocol} not allowed`)

  // Layer 2 — host shape.
  if (url.username || url.password) throw new SsrfError('credentials in url')

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '') // drop trailing dot
  if (!hostname) throw new SsrfError('empty host')
  if (BLOCKED_EXACT.has(hostname)) throw new SsrfError(`blocked host ${hostname}`)
  for (const tld of BLOCKED_TLDS) {
    if (hostname === tld.slice(1) || hostname.endsWith(tld)) {
      throw new SsrfError(`blocked tld ${tld}`)
    }
  }
  // Reject single-label hosts (no dot) unless it is an IP literal.
  const isLiteral = isIP(hostname) !== 0
  if (!isLiteral && !hostname.includes('.')) throw new SsrfError('single-label host')

  // Operator destination denylist.
  if (env.BLOCKED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))) {
    throw new SsrfError('host on operator denylist')
  }

  // Port.
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (!ALLOWED_PORTS.has(port)) throw new SsrfError(`port ${port} not allowed`)

  // Layers 3 & 4 — resolve and check every address, then pin one.
  if (isLiteral) {
    const family = isIP(hostname)
    const label = classifyIp(hostname, family)
    if (label) throw new SsrfError(`literal ip is ${label}`)
    // Guard against non-canonical IPv4 literals slipping through the URL parser.
    if (family === 4 && parseIpv4(hostname) === null) throw new SsrfError('non-canonical ipv4')
    return { url, address: hostname, family, hostname, port }
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new SsrfError('dns resolution failed')
  }
  if (addresses.length === 0) throw new SsrfError('no dns records')

  // If ANY address is blocked, reject the whole host — a mixed public/private
  // answer is a rebinding attack, not a misconfiguration.
  for (const { address, family } of addresses) {
    const label = classifyIp(address, family)
    if (label) throw new SsrfError(`resolves to ${label} (${address})`)
  }

  // Pin the first address. The client connects to THIS ip, sets Host: hostname,
  // and (for https) servername: hostname for SNI + cert validation. No second
  // lookup happens, so there is no rebinding window.
  const pinned = addresses[0]!
  return { url, address: pinned.address, family: pinned.family, hostname, port }
}

/** Cheap synchronous pre-check for obviously-bad URLs (before any async work). */
export function isPlausiblyFetchable(input: string): boolean {
  try {
    const u = new URL(input)
    return ALLOWED_SCHEMES.has(u.protocol)
  } catch {
    return false
  }
}
