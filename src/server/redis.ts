import type Redis from 'ioredis'
import { env } from '../lib/env'
import { logger } from '../lib/logger'

/**
 * Lazily-created shared Redis connection. Returns null when REDIS_URL is unset or
 * the connection cannot be established — callers fall back to in-process drivers.
 * A single connection is shared across cache and rate limiter.
 */

let client: Redis | null = null
let initialized = false
let warnedDown = false

export async function getRedis(): Promise<Redis | null> {
  if (!env.REDIS_URL) return null
  if (initialized) return client

  initialized = true
  try {
    // Dynamic import so the dependency is never loaded when Redis is not used.
    const { default: IORedis } = await import('ioredis')
    const instance = new IORedis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      connectTimeout: 3000,
    })
    instance.on('error', (err) => {
      if (!warnedDown) {
        warnedDown = true
        logger.warn({ err: err.message }, 'redis error — falling back to in-process drivers')
      }
    })
    instance.on('ready', () => {
      warnedDown = false
      logger.info('redis connected')
    })
    await instance.connect()
    client = instance
    return client
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'redis unavailable — using in-process drivers',
    )
    client = null
    return null
  }
}

export async function pingRedis(): Promise<{ ok: boolean; latencyMs: number } | null> {
  const redis = await getRedis()
  if (!redis) return null
  const start = performance.now()
  try {
    await redis.ping()
    return { ok: true, latencyMs: Math.round(performance.now() - start) }
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - start) }
  }
}
