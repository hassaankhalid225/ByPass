import type { NextRequest } from 'next/server'
import { env } from '../env'
import { AppError } from '../errors'
import { newRequestId, sanitizeRequestId } from '../ids'

/** Request-side helpers shared by handlers: id, client IP, JSON body parsing. */

export function getRequestId(req: NextRequest): string {
  return (
    sanitizeRequestId(req.headers.get('x-request-id')) ??
    sanitizeRequestId(req.headers.get('x-correlation-id')) ??
    newRequestId()
  )
}

/**
 * The real client IP, taken TRUSTED_PROXY_COUNT hops back from the right of
 * X-Forwarded-For — never the leftmost value, which the client controls and could
 * use to forge a distinct rate-limit bucket. See docs/07-security.md §4.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length > 0) {
      const idx = Math.max(0, parts.length - 1 - env.TRUSTED_PROXY_COUNT)
      return parts[idx] ?? parts[parts.length - 1]!
    }
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

const MAX_BODY_BYTES = 8 * 1024

/** Parse and size-limit a JSON body. Throws typed AppErrors on any problem. */
export async function parseJsonBody(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Send the body as application/json.')
  }

  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large.')
  }

  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large.')
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Request body is not valid JSON.')
  }
}
