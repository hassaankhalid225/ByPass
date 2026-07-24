import { logger } from '../../lib/logger'
import { getPool } from './pool'
import { MemoryStore } from './memory'
import { PostgresStore } from './postgres'
import type { Store } from './types'

let storePromise: Promise<Store> | null = null

export async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async () => {
      const pool = await getPool()
      if (!pool) return new MemoryStore()
      const store = new PostgresStore(pool)
      const health = await store.ready()
      if (!health.ok) {
        logger.warn('postgres not ready — using in-memory store for this process')
        return new MemoryStore()
      }
      return store
    })()
  }
  return storePromise
}

export function resetStore(): void {
  storePromise = null
}

export type {
  Store,
  ResolutionRecord,
  ResolutionStatus,
  AdapterHealth,
  AdapterStateRow,
  SystemSummary,
} from './types'
export { MemoryStore }
