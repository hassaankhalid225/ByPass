import { AppError } from '../lib/errors'
import { saltedHash } from '../lib/hash'
import { requestLogger, safeUrl } from '../lib/logger'
import { httpClient } from '../lib/net/http'
import { qrDataUri } from '../lib/qr'
import { extractMetadata } from '../lib/url/metadata'
import { normalizeUrl } from '../lib/url/normalize'
import { getCache } from './cache'

/**
 * Destination preview — "know before you click". Given a (usually already
 * resolved) URL, fetch it through the guarded client, extract the human-facing
 * summary, and attach a QR code. Every fetch passes the SSRF guard; results are
 * cached. This is the value-add on top of a bare destination URL.
 */

const CACHE_PREFIX = 'preview:v1:'
const CACHE_TTL_S = 3600

export interface PreviewResult {
  url: string
  finalHost: string
  isHttps: boolean
  contentType: string | null
  title: string | null
  description: string | null
  siteName: string | null
  /** QR code of the URL as an inline SVG data URI. */
  qr: string
  fetchedAt: string
}

export async function getPreview(rawUrl: string, requestId: string): Promise<PreviewResult> {
  const log = requestLogger(requestId)

  let normalized
  try {
    normalized = normalizeUrl(rawUrl)
  } catch {
    throw new AppError('INVALID_URL', 'That does not look like a valid URL.')
  }

  const cacheKey = CACHE_PREFIX + saltedHash(normalized.href)
  const cache = await getCache()
  const hit = await cache.get<PreviewResult>(cacheKey)
  if (hit) return hit

  const base: PreviewResult = {
    url: normalized.href,
    finalHost: normalized.url.host,
    isHttps: normalized.url.protocol === 'https:',
    contentType: null,
    title: null,
    description: null,
    siteName: null,
    qr: qrDataUri(normalized.href),
    fetchedAt: new Date().toISOString(),
  }

  try {
    const res = await httpClient.get(normalized.url, { accept: 'text/html,*/*;q=0.8' })
    const contentType = res.headers.get('content-type')
    base.contentType = contentType

    if (contentType && contentType.includes('text/html') && res.status < 400) {
      const html = await res.text()
      const meta = extractMetadata(html, normalized.url)
      base.title = meta.title
      base.description = meta.description
      base.siteName = meta.siteName
    }
  } catch (err) {
    // A preview is best-effort. If the destination can't be fetched, still return
    // the host + QR — the resolve already succeeded; the preview just adds context.
    log.info(
      { url: safeUrl(normalized.href), err: err instanceof Error ? err.message : 'unknown' },
      'preview fetch failed (best-effort)',
    )
  }

  await cache.set(cacheKey, base, CACHE_TTL_S).catch(() => {})
  return base
}
