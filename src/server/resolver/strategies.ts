import { AppError } from '../../lib/errors'
import {
  extractCanonical,
  extractJsLocation,
  extractMetaRefresh,
  isAbsoluteHttpUrl,
} from '../../lib/url/extract'
import type { AdapterResult, ResolveContext } from './types'

/** HTTP status codes that carry a Location redirect. */
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

/**
 * The backbone strategy: issue one request and turn the response into a single
 * hop. Handles Location redirects, then falls back to meta-refresh, JS location,
 * and canonical extraction from the body. Shared by every shortener adapter and by
 * the generic http-redirect adapter.
 */
export async function followOne(url: URL, ctx: ResolveContext): Promise<AdapterResult> {
  let res
  try {
    res = await ctx.http.get(url, { redirect: 'manual', signal: ctx.signal })
  } catch (err) {
    if (AppError.is(err)) return { kind: 'error', code: err.code, message: err.message }
    return { kind: 'error', code: 'UPSTREAM_ERROR', message: 'request failed' }
  }

  // 1. Location header on a redirect status.
  if (REDIRECT_CODES.has(res.status)) {
    const location = res.headers.get('location')
    if (location) {
      const next = safeResolve(location, url)
      if (next) return { kind: 'next', url: next, method: 'redirect', statusCode: res.status }
      return { kind: 'error', code: 'UPSTREAM_ERROR', message: 'invalid redirect target' }
    }
  }

  // 2. Body-based extraction for 2xx interstitials.
  const contentType = res.headers.get('content-type') ?? ''
  if (res.status >= 200 && res.status < 300 && contentType.includes('text/html')) {
    const html = await res.text()

    const meta = extractMetaRefresh(html)
    if (meta && meta !== url.toString()) {
      return { kind: 'next', url: meta, method: 'meta-refresh', statusCode: res.status }
    }

    const js = extractJsLocation(html)
    if (js && js !== url.toString()) {
      return { kind: 'next', url: js, method: 'html-extract', statusCode: res.status }
    }

    const canonical = extractCanonical(html)
    if (canonical && new URL(canonical).host !== url.host) {
      return { kind: 'next', url: canonical, method: 'html-extract', statusCode: res.status }
    }
  }

  // Nothing to follow — this adapter has no more to contribute.
  return { kind: 'skip', reason: `no redirect from status ${res.status}` }
}

/** Resolve a possibly-relative Location against the base, returning an http(s) URL. */
function safeResolve(location: string, base: URL): string | null {
  try {
    const resolved = new URL(location, base).toString()
    return isAbsoluteHttpUrl(resolved) ? resolved : null
  } catch {
    return null
  }
}
