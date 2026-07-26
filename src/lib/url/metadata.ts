/**
 * HTML metadata extraction for the destination preview. Pure string work — no I/O,
 * no DOM. Given a page's HTML and its URL, pull the human-facing summary a user
 * needs to decide whether to click: title, description, site name, favicon.
 */

export interface PageMetadata {
  title: string | null
  description: string | null
  siteName: string | null
  faviconUrl: string | null
}

function firstMatch(re: RegExp, html: string): string | null {
  const m = re.exec(html)
  return m && m[1] ? decodeEntities(m[1].trim()) : null
}

/** Read a <meta> value by property/name, tolerant of attribute order. */
function metaContent(html: string, key: string): string | null {
  const attr = key.replace(/[:.]/g, '\\$&')
  // content before the key
  const a = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${attr}["']`,
    'i',
  )
  // key before content
  const b = new RegExp(
    `<meta[^>]+(?:property|name)=["']${attr}["'][^>]*content=["']([^"']*)["']`,
    'i',
  )
  return firstMatch(b, html) ?? firstMatch(a, html)
}

export function extractMetadata(html: string, baseUrl: URL): PageMetadata {
  const title =
    metaContent(html, 'og:title') ??
    metaContent(html, 'twitter:title') ??
    firstMatch(/<title[^>]*>([^<]*)<\/title>/i, html)

  const description =
    metaContent(html, 'description') ??
    metaContent(html, 'og:description') ??
    metaContent(html, 'twitter:description')

  const siteName = metaContent(html, 'og:site_name')

  const faviconUrl = extractFavicon(html, baseUrl)

  return {
    title: clamp(title, 200),
    description: clamp(description, 400),
    siteName: clamp(siteName, 120),
    faviconUrl,
  }
}

function extractFavicon(html: string, baseUrl: URL): string | null {
  // Look for <link rel="icon" | "shortcut icon" | "apple-touch-icon" href="…">
  const linkRe = /<link[^>]+>/gi
  let match: RegExpExecArray | null
  let best: string | null = null
  while ((match = linkRe.exec(html)) !== null) {
    const tag = match[0]
    if (!/rel=["'][^"']*icon[^"']*["']/i.test(tag)) continue
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href) continue
    try {
      const abs = new URL(href, baseUrl)
      if (abs.protocol === 'http:' || abs.protocol === 'https:') {
        best = abs.toString()
        if (/rel=["'][^"']*shortcut[^"']*["']/i.test(tag) || /rel=["']icon["']/i.test(tag)) {
          return best // prefer a plain icon / shortcut icon
        }
      }
    } catch {
      /* ignore bad href */
    }
  }
  if (best) return best
  // Fallback to the well-known location.
  try {
    return new URL('/favicon.ico', baseUrl).toString()
  } catch {
    return null
  }
}

function clamp(value: string | null, max: number): string | null {
  if (!value) return null
  const v = value.replace(/\s+/g, ' ').trim()
  if (!v) return null
  return v.length > max ? v.slice(0, max - 1) + '…' : v
}

/** Decode the handful of HTML entities that commonly appear in titles. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : _
    })
}
