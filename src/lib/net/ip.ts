/**
 * IP range classification for the SSRF guard. Pure arithmetic over parsed
 * addresses — no I/O. Every range that must never be reached from user input is
 * listed here with its RFC reference. See docs/07-security.md §2.3.
 */

/** Parse an IPv4 dotted-quad into a 32-bit unsigned integer, or null. */
export function parseIpv4(host: string): number | null {
  // Only accept canonical dotted-decimal. Decimal/octal/hex forms (e.g.
  // 2130706433, 0177.0.0.1, 0x7f.0.0.1, 127.1) are rejected here on purpose —
  // they are classic SSRF bypasses. The DNS layer only ever hands us canonical
  // forms, and raw literals must be canonical to be trusted.
  const parts = host.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    value = value * 256 + n
  }
  return value >>> 0
}

interface V4Range {
  base: number
  bits: number
  label: string
}

function cidr(ip: string, bits: number, label: string): V4Range {
  return { base: parseIpv4(ip)!, bits, label }
}

const V4_BLOCKED: V4Range[] = [
  cidr('0.0.0.0', 8, 'current network'),
  cidr('10.0.0.0', 8, 'private'),
  cidr('100.64.0.0', 10, 'CGNAT'),
  cidr('127.0.0.0', 8, 'loopback'),
  cidr('169.254.0.0', 16, 'link-local / cloud metadata'),
  cidr('172.16.0.0', 12, 'private'),
  cidr('192.0.0.0', 24, 'IETF protocol assignments'),
  cidr('192.0.2.0', 24, 'TEST-NET-1'),
  cidr('192.88.99.0', 24, '6to4 relay anycast'),
  cidr('192.168.0.0', 16, 'private'),
  cidr('198.18.0.0', 15, 'benchmarking'),
  cidr('198.51.100.0', 24, 'TEST-NET-2'),
  cidr('203.0.113.0', 24, 'TEST-NET-3'),
  cidr('224.0.0.0', 4, 'multicast'),
  cidr('240.0.0.0', 4, 'reserved'),
  cidr('255.255.255.255', 32, 'broadcast'),
]

/** Returns the label of the blocked range containing this IPv4, or null if public. */
export function classifyIpv4(value: number): string | null {
  for (const range of V4_BLOCKED) {
    const mask = range.bits === 0 ? 0 : (0xffffffff << (32 - range.bits)) >>> 0
    if ((value & mask) === (range.base & mask)) return range.label
  }
  return null
}

/**
 * Classify an IPv6 address given as its 8 hextet groups (numbers 0..0xffff).
 * Handles IPv4-mapped (::ffff:a.b.c.d) by unwrapping to IPv4 and re-checking.
 */
export function classifyIpv6(groups: number[]): string | null {
  if (groups.length !== 8) return 'malformed ipv6'

  const isZero = (n: number, count: number) => groups.slice(0, count).every((g) => g === 0)

  // ::/128 unspecified, ::1/128 loopback
  if (isZero(0, 7)) {
    if (groups[7] === 0) return 'unspecified'
    if (groups[7] === 1) return 'loopback'
  }

  // IPv4-mapped ::ffff:0:0/96  and IPv4-compatible ::/96 — unwrap and re-check.
  if (isZero(0, 5) && (groups[5] === 0xffff || groups[5] === 0)) {
    const v4 = ((groups[6]! << 16) | groups[7]!) >>> 0
    const v4label = classifyIpv4(v4)
    if (v4label) return `ipv4-mapped ${v4label}`
  }

  const first = groups[0]!
  // ff00::/8 multicast
  if ((first & 0xff00) === 0xff00) return 'multicast'
  // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfe80) return 'link-local'
  // fec0::/10 site-local (deprecated but still routed by some stacks)
  if ((first & 0xffc0) === 0xfec0) return 'site-local'
  // fc00::/7 unique-local
  if ((first & 0xfe00) === 0xfc00) return 'unique-local'
  // 2001:db8::/32 documentation
  if (first === 0x2001 && groups[1] === 0x0db8) return 'documentation'
  // 64:ff9b::/96 NAT64
  if (first === 0x0064 && groups[1] === 0xff9b) return 'NAT64'
  // 100::/64 discard-only
  if (first === 0x0100 && isZero(1, 3) && groups[3] === 0) return 'discard'

  return null
}

/**
 * Classify any IP literal (v4 or v6 string as returned by dns.lookup). Returns a
 * block reason label, or null if the address is a normal public address.
 */
export function classifyIp(address: string, family: number): string | null {
  if (family === 4) {
    const v4 = parseIpv4(address)
    if (v4 === null) return 'malformed ipv4'
    return classifyIpv4(v4)
  }
  if (family === 6) {
    const groups = parseIpv6Groups(address)
    if (!groups) return 'malformed ipv6'
    return classifyIpv6(groups)
  }
  return 'unknown address family'
}

/** Expand an IPv6 string (possibly with :: and an embedded v4 tail) into 8 groups. */
export function parseIpv6Groups(address: string): number[] | null {
  let addr = address.trim()
  // Strip a zone id (fe80::1%eth0) and surrounding brackets.
  addr = addr.replace(/^\[/, '').replace(/\]$/, '')
  const zone = addr.indexOf('%')
  if (zone !== -1) addr = addr.slice(0, zone)

  // Handle an embedded IPv4 tail (::ffff:127.0.0.1).
  let v4tail: number[] | null = null
  const lastColon = addr.lastIndexOf(':')
  const tail = addr.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseIpv4(tail)
    if (v4 === null) return null
    v4tail = [(v4 >>> 16) & 0xffff, v4 & 0xffff]
    addr = addr.slice(0, lastColon + 1) + '0:0'
  }

  const halves = addr.split('::')
  if (halves.length > 2) return null

  const toGroups = (s: string): number[] | null => {
    if (s === '') return []
    const out: number[] = []
    for (const part of s.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null
      out.push(parseInt(part, 16))
    }
    return out
  }

  let groups: number[]
  if (halves.length === 2) {
    const head = toGroups(halves[0]!)
    const back = toGroups(halves[1]!)
    if (!head || !back) return null
    const fill = 8 - head.length - back.length
    if (fill < 0) return null
    groups = [...head, ...Array(fill).fill(0), ...back]
  } else {
    const all = toGroups(addr)
    if (!all) return null
    groups = all
  }

  // Replace the placeholder groups with the real v4 tail if present.
  if (v4tail) {
    groups[6] = v4tail[0]!
    groups[7] = v4tail[1]!
  }

  return groups.length === 8 ? groups : null
}
