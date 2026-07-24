/**
 * The single error vocabulary for the whole system.
 *
 * Every failure a client can see maps to one of these codes. The code is stable
 * and machine-readable; the message is written for a human reading a terminal and
 * never contains a stack trace, a file path, SQL, or an upstream response body.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_URL',
  'BLOCKED_URL',
  'UNSUPPORTED_URL',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
  'LOOP_DETECTED',
  'MAX_HOPS_EXCEEDED',
  'ADAPTER_DISABLED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'METHOD_NOT_ALLOWED',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_URL: 400,
  BLOCKED_URL: 403,
  UNSUPPORTED_URL: 422,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  UPSTREAM_TIMEOUT: 504,
  LOOP_DETECTED: 422,
  MAX_HOPS_EXCEEDED: 422,
  ADAPTER_DISABLED: 503,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  METHOD_NOT_ALLOWED: 405,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

export interface AppErrorOptions {
  /** Structured, safe-to-expose detail (e.g. field errors, retryAfter). */
  details?: Record<string, unknown>
  /** The underlying cause. Logged, never sent to the client. */
  cause?: unknown
}

/**
 * A typed, client-safe error. Handlers translate this straight into the response
 * envelope. Anything that is NOT an AppError becomes an opaque INTERNAL_ERROR.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: Record<string, unknown> | undefined

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.status = HTTP_STATUS[code]
    this.details = options.details
  }

  static is(value: unknown): value is AppError {
    return value instanceof AppError
  }
}

/** Convenience constructors for the codes used most often. */
export const errors = {
  validation: (message: string, fields?: Record<string, string[]>) =>
    new AppError('VALIDATION_ERROR', message, fields ? { details: { fields } } : {}),
  invalidUrl: (message = 'That does not look like a valid URL.') =>
    new AppError('INVALID_URL', message),
  blockedUrl: (
    message = 'That host is blocked. Private and internal addresses cannot be resolved.',
  ) => new AppError('BLOCKED_URL', message),
  unsupported: (message = 'No adapter handles this link yet.') =>
    new AppError('UNSUPPORTED_URL', message),
  rateLimited: (retryAfter: number) =>
    new AppError('RATE_LIMITED', 'Too many requests. Slow down and try again shortly.', {
      details: { retryAfter },
    }),
  upstream: (message = 'The target responded in a way we could not use.') =>
    new AppError('UPSTREAM_ERROR', message),
  upstreamTimeout: (message = 'The target took too long to respond.') =>
    new AppError('UPSTREAM_TIMEOUT', message),
  loop: (message = 'This link redirects in a loop.') => new AppError('LOOP_DETECTED', message),
  maxHops: (message = 'This link chains through too many hops.') =>
    new AppError('MAX_HOPS_EXCEEDED', message),
  adapterDisabled: (message = 'The service that handles this link is temporarily unavailable.') =>
    new AppError('ADAPTER_DISABLED', message),
  unauthorized: (message = 'Sign in to continue.') => new AppError('UNAUTHORIZED', message),
  notFound: (message = 'Not found.') => new AppError('NOT_FOUND', message),
  internal: (cause?: unknown) =>
    new AppError('INTERNAL_ERROR', 'Something went wrong on our side.', { cause }),
}

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code]
}
