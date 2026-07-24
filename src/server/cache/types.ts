/** The cache contract. Two drivers implement it: Redis and in-process LRU. */
export interface CacheDriver {
  readonly name: 'redis' | 'memory'
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  /** Delete every key under a prefix. Used by the admin cache-purge action. */
  deletePrefix(prefix: string): Promise<number>
}
