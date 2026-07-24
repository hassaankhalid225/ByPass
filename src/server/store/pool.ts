import type { Pool } from 'pg'
import { env } from '../../lib/env'
import { logger } from '../../lib/logger'

/**
 * Lazily-created shared PostgreSQL pool. Returns null when DATABASE_URL is unset
 * or the pool cannot be created — callers fall back to the in-memory store.
 */

let pool: Pool | null = null
let initialized = false

export async function getPool(): Promise<Pool | null> {
  if (!env.DATABASE_URL) return null
  if (initialized) return pool

  initialized = true
  try {
    const { Pool: PgPool } = await import('pg')
    const instance = new PgPool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      application_name: 'clearway',
    })
    instance.on('error', (err) => {
      logger.warn({ err: err.message }, 'postgres pool error')
    })
    pool = instance
    return pool
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : 'unknown' },
      'postgres unavailable — using in-memory store',
    )
    pool = null
    return null
  }
}
