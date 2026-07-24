import type { CacheDriver } from './types'

/**
 * In-process LRU cache with per-entry TTL. The fallback when Redis is not
 * configured, and the default in dev and test — so this code path is always
 * exercised, never a theoretical incident-only branch (ADR-0004).
 */

interface Entry {
  value: unknown
  expiresAt: number
}

const MAX_ENTRIES = 5000

export class MemoryCache implements CacheDriver {
  readonly name = 'memory' as const
  private store = new Map<string, Entry>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    // LRU touch: re-insert to move to the end.
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
      // Evict the least-recently-used (first) entry.
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async deletePrefix(prefix: string): Promise<number> {
    let count = 0
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
        count += 1
      }
    }
    return count
  }
}
