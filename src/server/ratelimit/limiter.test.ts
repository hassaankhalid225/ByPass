import { describe, expect, it } from 'vitest'
import { MemoryRateLimiter } from './memory'

describe('MemoryRateLimiter — sliding window', () => {
  it('allows up to the limit, then rejects', async () => {
    const now = 1_000_000
    const limiter = new MemoryRateLimiter(() => now)

    for (let i = 0; i < 3; i += 1) {
      const r = await limiter.hit('k', 3, 60)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(3 - (i + 1))
    }
    const rejected = await limiter.hit('k', 3, 60)
    expect(rejected.allowed).toBe(false)
    expect(rejected.remaining).toBe(0)
    expect(rejected.retryAfter).toBeGreaterThan(0)
  })

  it('rolls the window as time advances', async () => {
    let now = 1_000_000
    const limiter = new MemoryRateLimiter(() => now)

    await limiter.hit('k', 2, 60)
    await limiter.hit('k', 2, 60)
    expect((await limiter.hit('k', 2, 60)).allowed).toBe(false)

    // Advance past the window; the old hits age out.
    now += 61_000
    expect((await limiter.hit('k', 2, 60)).allowed).toBe(true)
  })

  it('keeps separate buckets per key', async () => {
    const now = 1_000_000
    const limiter = new MemoryRateLimiter(() => now)
    await limiter.hit('a', 1, 60)
    expect((await limiter.hit('a', 1, 60)).allowed).toBe(false)
    expect((await limiter.hit('b', 1, 60)).allowed).toBe(true)
  })
})
