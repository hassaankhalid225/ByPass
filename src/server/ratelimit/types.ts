export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  /** Unix seconds when the window resets (oldest entry ages out). */
  resetAt: number
  /** Seconds to wait before retrying. 0 when allowed. */
  retryAfter: number
}

export interface RateLimiterDriver {
  readonly name: 'redis' | 'memory'
  /**
   * Record a hit against `key` and report whether it is within `limit` over the
   * trailing `windowSeconds`. Atomic: concurrent calls cannot race past the limit.
   */
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>
}
