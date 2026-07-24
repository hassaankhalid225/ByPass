/**
 * Extraction helpers shared by the generic adapters. Pure string work — no I/O,
 * no DOM, no script execution.
 */

const ABSOLUTE_URL_RE = /https?:\/\/[^\s"'<>()]+/i

/** Known wrapper parameters that carry a redirect target, in priority order. */
export const WRAPPER_PARAMS = [
  'url',
  'u',
  'to',
  'dest',
  'destination',
  'target',
  'redirect',
  'redirect_uri',
  'link',
  'r',
  'out',
  'goto',
  'continue',
  'q',
] as const

/** First absolute http(s) URL found in an arbitrary string, or null. */
export function extractFirstUrl(text: string): string | null {
  const match = ABSOLUTE_URL_RE.exec(text)
  if (!match) return null
  // Trim trailing punctuation that commonly clings to a URL in prose.
  return match[0].replace(/[.,;:!?)\]}'"]+$/, '')
}

/**
 * Pull a destination from a known wrapper query parameter. The value may be raw,
 * percent-encoded, or double-encoded. Returns an absolute http(s) URL or null.
 */
export function extractWrapperParam(url: URL): string | null {
  for (const key of WRAPPER_PARAMS) {
    const raw = url.searchParams.get(key)
    if (!raw) continue
    const candidate = decodeMaybe(raw)
    if (isAbsoluteHttpUrl(candidate)) return candidate
  }
  return null
}

/** Parse a `<meta http-equiv="refresh" content="N;url=…">` target from HTML. */
export function extractMetaRefresh(html: string): string | null {
  const meta = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/i.exec(html)
  if (!meta) return null
  const content = /content=["']?[^"'>]*url=([^"';\s>]+)/i.exec(meta[0])
  if (!content || !content[1]) return null
  const candidate = decodeMaybe(content[1])
  return isAbsoluteHttpUrl(candidate) ? candidate : null
}

/** Parse a `<link rel="canonical" href="…">` target from HTML. */
export function extractCanonical(html: string): string | null {
  const link = /<link[^>]+rel=["']?canonical["']?[^>]*>/i.exec(html)
  if (!link) return null
  const href = /href=["']([^"']+)["']/i.exec(link[0])
  if (!href || !href[1]) return null
  return isAbsoluteHttpUrl(href[1]) ? href[1] : null
}

/**
 * Read an unambiguous JS redirect from inline scripts. Pattern-matching only — no
 * execution, no DOM. Matches location assignments/replaces with a literal string.
 */
export function extractJsLocation(html: string): string | null {
  const patterns = [
    /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /(?:window\.)?location\.replace\(\s*["']([^"']+)["']\s*\)/i,
    /(?:window\.)?location\.assign\(\s*["']([^"']+)["']\s*\)/i,
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (m && m[1] && isAbsoluteHttpUrl(m[1])) return m[1]
  }
  return null
}

/**
 * Decode base64 / base64url segments found in a path or query, returning the first
 * that decodes to an absolute http(s) URL.
 */
export function extractBase64Url(url: URL): string | null {
  const candidates: string[] = [
    ...url.pathname.split('/'),
    ...[...url.searchParams.values()],
  ].filter((s) => s.length >= 12)

  for (const seg of candidates) {
    const decoded = tryBase64(seg)
    if (decoded && isAbsoluteHttpUrl(decoded)) return decoded
    // Some wrappers embed the URL after the base64 text; scan the decoded blob.
    if (decoded) {
      const found = extractFirstUrl(decoded)
      if (found) return found
    }
  }
  return null
}

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function decodeMaybe(value: string): string {
  try {
    // Handle double-encoding by decoding until stable (bounded).
    let out = value
    for (let i = 0; i < 3; i += 1) {
      const next = decodeURIComponent(out)
      if (next === out) break
      out = next
    }
    return out
  } catch {
    return value
  }
}

/** True if the character code is an ASCII control character (excluding tab/CR/LF). */
function isControlChar(code: number): boolean {
  return code < 0x09 || (code > 0x0d && code < 0x20)
}

function tryBase64(segment: string): string | null {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null
  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8')
    if (!decoded) return null
    // Reject control-char decodes (base64 false positives). A loop, not a regex,
    // so no literal control characters live in this source file.
    for (let i = 0; i < decoded.length; i += 1) {
      if (isControlChar(decoded.charCodeAt(i))) return null
    }
    return decoded
  } catch {
    return null
  }
}
