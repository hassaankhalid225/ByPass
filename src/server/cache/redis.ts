import type Redis from 'ioredis'
import type { CacheDriver } from './types'

/**
 * Redis-backed cache. Values are JSON-serialised. TTL is native Redis expiry.
 * deletePrefix uses SCAN (never KEYS) so it stays non-blocking on large keyspaces.
 */
export class RedisCache implements CacheDriver {
  readonly name = 'redis' as const
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value)
    if (ttlSeconds > 0) {
      await this.redis.set(key, raw, 'EX', ttlSeconds)
    } else {
      await this.redis.set(key, raw)
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async deletePrefix(prefix: string): Promise<number> {
    let cursor = '0'
    let count = 0
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200)
      cursor = next
      if (keys.length > 0) {
        count += await this.redis.del(...keys)
      }
    } while (cursor !== '0')
    return count
  }
}
