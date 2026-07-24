import { saltedHash } from '../../lib/hash'
import { getRedis } from '../redis'
import { MemoryRateLimiter } from './memory'
import { RedisRateLimiter } from './redis'
import type { RateLimiterDriver, RateLimitResult } from './types'

let limiterPromise: Promise<RateLimiterDriver> | null = null

export async function getRateLimiter(): Promise<RateLimiterDriver> {
  if (!limiterPromise) {
    limiterPromise = (async () => {
      const redis = await getRedis()
      return redis ? new RedisRateLimiter(redis) : new MemoryRateLimiter()
    })()
  }
  return limiterPromise
}

/**
 * Rate-limit a client for a named bucket. The client identifier (an IP) is hashed
 * before it ever becomes a key, so raw IPs are never stored — even transiently in
 * Redis. See docs/07-security.md §8.
 */
export async function rateLimit(
  bucket: string,
  clientId: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const limiter = await getRateLimiter()
  const key = `rl:${bucket}:${saltedHash(clientId)}`
  return limiter.hit(key, limit, windowSeconds)
}

export function resetRateLimiter(): void {
  limiterPromise = null
}

export type { RateLimiterDriver, RateLimitResult }
export { MemoryRateLimiter }
