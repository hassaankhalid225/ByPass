import { getRedis } from '../redis'
import { MemoryCache } from './memory'
import { RedisCache } from './redis'
import type { CacheDriver } from './types'

/**
 * Resolves the active cache driver once per process: Redis when reachable, the
 * in-process LRU otherwise. The choice is transparent to callers.
 */

let cachePromise: Promise<CacheDriver> | null = null

export async function getCache(): Promise<CacheDriver> {
  if (!cachePromise) {
    cachePromise = (async () => {
      const redis = await getRedis()
      return redis ? new RedisCache(redis) : new MemoryCache()
    })()
  }
  return cachePromise
}

/** Reset for tests. */
export function resetCache(): void {
  cachePromise = null
}

export type { CacheDriver }
export { MemoryCache }
