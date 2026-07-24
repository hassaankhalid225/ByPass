import type Redis from 'ioredis'
import type { RateLimiterDriver, RateLimitResult } from './types'

/**
 * Redis sliding-window rate limiter backed by a sorted set, executed as one atomic
 * Lua script so concurrent requests cannot race past the limit. The script prunes
 * aged entries, counts the window, and conditionally adds the new hit — all in a
 * single round trip under Redis's single-threaded execution.
 */

// KEYS[1] = bucket key
// ARGV[1] = now (ms)   ARGV[2] = window (ms)   ARGV[3] = limit   ARGV[4] = member id
const SCRIPT = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local count = redis.call('ZCARD', key)
local allowed = 0
if count < limit then
  redis.call('ZADD', key, now, member)
  count = count + 1
  allowed = 1
end
redis.call('PEXPIRE', key, window)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = now
if oldest[2] ~= nil then oldestScore = tonumber(oldest[2]) end
return { allowed, count, oldestScore }
`

export class RedisRateLimiter implements RateLimiterDriver {
  readonly name = 'redis' as const
  private counter = 0

  constructor(private readonly redis: Redis) {
    // Register the script as a custom command for cached EVALSHA dispatch.
    if (!(redis as unknown as { slidingWindow?: unknown }).slidingWindow) {
      redis.defineCommand('slidingWindow', { numberOfKeys: 1, lua: SCRIPT })
    }
  }

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const nowMs = Date.now()
    const windowMs = windowSeconds * 1000
    this.counter += 1
    const member = `${nowMs}-${this.counter}`

    const [allowedRaw, countRaw, oldestRaw] = (await (
      this.redis as unknown as {
        slidingWindow: (
          key: string,
          now: number,
          window: number,
          limit: number,
          member: string,
        ) => Promise<[number, number, number]>
      }
    ).slidingWindow(key, nowMs, windowMs, limit, member)) as [number, number, number]

    const allowed = allowedRaw === 1
    const count = Number(countRaw)
    const oldest = Number(oldestRaw)
    const resetAtMs = oldest + windowMs
    const remaining = Math.max(0, limit - count)
    const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000))

    return {
      allowed,
      limit,
      remaining,
      resetAt: Math.ceil(resetAtMs / 1000),
      retryAfter,
    }
  }
}
