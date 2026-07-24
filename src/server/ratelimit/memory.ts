import type { RateLimiterDriver, RateLimitResult } from './types'

/**
 * In-process sliding-window rate limiter. Keeps per-key timestamp lists and prunes
 * entries older than the window on each hit. Behaviour matches the Redis driver so
 * the two are interchangeable (asserted by a contract test).
 *
 * A clock is injectable so window/rollover tests are deterministic and never sleep.
 */
export class MemoryRateLimiter implements RateLimiterDriver {
  readonly name = 'memory' as const
  private hits = new Map<string, number[]>()

  constructor(private readonly now: () => number = () => Date.now()) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const nowMs = this.now()
    const windowMs = windowSeconds * 1000
    const cutoff = nowMs - windowMs

    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > cutoff)

    const allowed = timestamps.length < limit
    if (allowed) timestamps.push(nowMs)
    this.hits.set(key, timestamps)

    // Opportunistic cleanup to bound memory.
    if (this.hits.size > 10000) this.prune(cutoff)

    const oldest = timestamps[0] ?? nowMs
    const resetAtMs = oldest + windowMs
    const remaining = Math.max(0, limit - timestamps.length)
    const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000))

    return {
      allowed,
      limit,
      remaining,
      resetAt: Math.ceil(resetAtMs / 1000),
      retryAfter,
    }
  }

  private prune(cutoff: number): void {
    for (const [key, list] of this.hits) {
      const kept = list.filter((t) => t > cutoff)
      if (kept.length === 0) this.hits.delete(key)
      else this.hits.set(key, kept)
    }
  }
}
