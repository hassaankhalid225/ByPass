import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from './memory'

describe('MemoryCache', () => {
  it('stores and retrieves a value', async () => {
    const cache = new MemoryCache()
    await cache.set('k', { a: 1 }, 60)
    expect(await cache.get<{ a: number }>('k')).toEqual({ a: 1 })
  })

  it('expires a value after its ttl', async () => {
    vi.useFakeTimers()
    const cache = new MemoryCache()
    await cache.set('k', 'v', 1)
    vi.advanceTimersByTime(1500)
    expect(await cache.get('k')).toBeNull()
    vi.useRealTimers()
  })

  it('deletes by prefix', async () => {
    const cache = new MemoryCache()
    await cache.set('resolve:1', 'a', 60)
    await cache.set('resolve:2', 'b', 60)
    await cache.set('other:1', 'c', 60)
    const purged = await cache.deletePrefix('resolve:')
    expect(purged).toBe(2)
    expect(await cache.get('other:1')).toBe('c')
  })
})
