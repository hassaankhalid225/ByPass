import { NextResponse } from 'next/server'
import { AppError } from '../errors'
import { logger } from '../logger'
import type { RateLimitResult } from '../../server/ratelimit'

/**
 * The API response envelope. Every handler returns through `ok()` or `fail()`, so
 * the shape is uniform and the requestId is always present. See
 * docs/04-api-specification.md §1.
 */

export interface ApiHeaders {
  requestId: string
  rateLimit?: RateLimitResult
  extra?: Record<string, string>
}

function baseHeaders({ requestId, rateLimit, extra }: ApiHeaders): Headers {
  const headers = new Headers(extra)
  headers.set('X-Request-Id', requestId)
  headers.set('Cache-Control', headers.get('Cache-Control') ?? 'no-store')
  if (rateLimit) {
    headers.set('X-RateLimit-Limit', String(rateLimit.limit))
    headers.set('X-RateLimit-Remaining', String(rateLimit.remaining))
    headers.set('X-RateLimit-Reset', String(rateLimit.resetAt))
  }
  return headers
}

export function ok<T>(data: T, meta: ApiHeaders, status = 200): NextResponse {
  return NextResponse.json(
    { ok: true, data, requestId: meta.requestId },
    {
      status,
      headers: baseHeaders(meta),
    },
  )
}

export function fail(error: AppError, meta: ApiHeaders): NextResponse {
  const headers = baseHeaders(meta)
  if (error.code === 'RATE_LIMITED' && meta.rateLimit) {
    headers.set('Retry-After', String(meta.rateLimit.retryAfter))
  } else if (error.details && typeof error.details.retryAfter === 'number') {
    headers.set('Retry-After', String(error.details.retryAfter))
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId: meta.requestId,
    },
    { status: error.status, headers },
  )
}

/** Translate any thrown value into a safe envelope. Non-AppErrors become opaque. */
export function failUnknown(err: unknown, meta: ApiHeaders): NextResponse {
  if (AppError.is(err)) return fail(err, meta)
  logger.error(
    { requestId: meta.requestId, err: err instanceof Error ? err.stack : String(err) },
    'unhandled error in handler',
  )
  return fail(new AppError('INTERNAL_ERROR', 'Something went wrong on our side.'), meta)
}
