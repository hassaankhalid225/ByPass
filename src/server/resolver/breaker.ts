import { env } from '../../lib/env'
import type { Store } from '../store'

/**
 * Per-adapter circuit breaker. Backed by adapter_state so it is shared across
 * instances and survives a restart. State transitions:
 *
 *   closed --[N consecutive failures]--> open --[cooldown]--> half-open
 *     ^                                                          |
 *     +-------------------[one success]---------------------------+
 *                            |
 *               [one failure]--> open (cooldown doubles, capped)
 *
 * Only adapter failures trip it — BLOCKED_URL/VALIDATION_ERROR are the user's
 * problem and are excluded by the engine before it calls recordFailure. See
 * docs/06-resolver-engine.md §6.
 */

export type BreakerDecision = { allowed: true } | { allowed: false; reason: string }

export class Breaker {
  constructor(private readonly store: Store) {}

  /** Whether an adapter may run right now. Transitions open->half-open on cooldown. */
  async check(adapterId: string): Promise<BreakerDecision> {
    const state = await this.store.getAdapterState(adapterId)
    if (!state) return { allowed: true }
    if (!state.enabled) return { allowed: false, reason: 'disabled by operator' }

    if (state.breakerState === 'open') {
      const openedAt = state.openedAt?.getTime() ?? 0
      const cooldown = this.cooldownFor(state.consecutiveFailures)
      if (Date.now() - openedAt >= cooldown) {
        await this.store.upsertAdapterState(adapterId, { breakerState: 'half-open' })
        return { allowed: true }
      }
      return { allowed: false, reason: 'circuit open' }
    }
    return { allowed: true }
  }

  async recordSuccess(adapterId: string): Promise<void> {
    await this.store.upsertAdapterState(adapterId, {
      breakerState: 'closed',
      consecutiveFailures: 0,
      lastSuccessAt: new Date(),
    })
  }

  async recordFailure(adapterId: string): Promise<void> {
    const state = await this.store.getAdapterState(adapterId)
    const failures = (state?.consecutiveFailures ?? 0) + 1
    const shouldOpen = failures >= env.BREAKER_THRESHOLD
    await this.store.upsertAdapterState(adapterId, {
      consecutiveFailures: failures,
      lastFailureAt: new Date(),
      ...(shouldOpen ? { breakerState: 'open', openedAt: new Date() } : {}),
    })
  }

  private cooldownFor(consecutiveFailures: number): number {
    // Exponential from the base, doubling per failure past the threshold, capped.
    const over = Math.max(0, consecutiveFailures - env.BREAKER_THRESHOLD)
    const cooldown = env.BREAKER_COOLDOWN_MS * 2 ** over
    return Math.min(cooldown, env.BREAKER_MAX_COOLDOWN_MS)
  }
}
