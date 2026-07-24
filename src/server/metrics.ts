/**
 * In-process metric counters, rendered as Prometheus text at /api/metrics. The set
 * is small enough (a handful of series) that a client library would be more surface
 * than value. See docs/04-api-specification.md §8.
 */

const DURATION_BUCKETS = [100, 250, 500, 1000, 2000, 4000, 8000, 15000]

class Metrics {
  private resolveTotal = { success: 0, failure: 0 }
  private durationBucketCounts = new Array(DURATION_BUCKETS.length + 1).fill(0)
  private durationSum = 0
  private durationCount = 0
  private adapterTotal = new Map<string, { success: number; failure: number }>()
  private breakerOpen = new Set<string>()
  private cacheTotal = { hit: 0, miss: 0 }
  private rateLimitRejected = 0

  recordResolve(status: 'success' | 'failure', durationMs: number): void {
    this.resolveTotal[status] += 1
    this.durationSum += durationMs
    this.durationCount += 1
    let placed = false
    for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
      if (durationMs <= DURATION_BUCKETS[i]!) {
        this.durationBucketCounts[i] += 1
        placed = true
        break
      }
    }
    if (!placed) this.durationBucketCounts[DURATION_BUCKETS.length] += 1
  }

  recordAdapter(adapterId: string, status: 'success' | 'failure'): void {
    const entry = this.adapterTotal.get(adapterId) ?? { success: 0, failure: 0 }
    entry[status] += 1
    this.adapterTotal.set(adapterId, entry)
  }

  setBreakerOpen(adapterId: string, open: boolean): void {
    if (open) this.breakerOpen.add(adapterId)
    else this.breakerOpen.delete(adapterId)
  }

  recordCache(result: 'hit' | 'miss'): void {
    this.cacheTotal[result] += 1
  }

  recordRateLimitRejected(): void {
    this.rateLimitRejected += 1
  }

  render(version: string, commit: string): string {
    const lines: string[] = []
    const add = (s: string) => lines.push(s)

    add('# HELP clearway_resolve_total Total resolve attempts by status.')
    add('# TYPE clearway_resolve_total counter')
    add(`clearway_resolve_total{status="success"} ${this.resolveTotal.success}`)
    add(`clearway_resolve_total{status="failure"} ${this.resolveTotal.failure}`)

    add('# HELP clearway_resolve_duration_ms Resolve duration histogram (ms).')
    add('# TYPE clearway_resolve_duration_ms histogram')
    let cumulative = 0
    for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
      cumulative += this.durationBucketCounts[i]
      add(`clearway_resolve_duration_ms_bucket{le="${DURATION_BUCKETS[i]}"} ${cumulative}`)
    }
    cumulative += this.durationBucketCounts[DURATION_BUCKETS.length]
    add(`clearway_resolve_duration_ms_bucket{le="+Inf"} ${cumulative}`)
    add(`clearway_resolve_duration_ms_sum ${this.durationSum}`)
    add(`clearway_resolve_duration_ms_count ${this.durationCount}`)

    add('# HELP clearway_adapter_total Adapter hops by status.')
    add('# TYPE clearway_adapter_total counter')
    for (const [adapter, counts] of this.adapterTotal) {
      add(`clearway_adapter_total{adapter="${adapter}",status="success"} ${counts.success}`)
      add(`clearway_adapter_total{adapter="${adapter}",status="failure"} ${counts.failure}`)
    }

    add('# HELP clearway_adapter_breaker_open Whether an adapter breaker is open (1) or not (0).')
    add('# TYPE clearway_adapter_breaker_open gauge')
    for (const adapter of this.breakerOpen) {
      add(`clearway_adapter_breaker_open{adapter="${adapter}"} 1`)
    }

    add('# HELP clearway_cache_total Cache lookups by result.')
    add('# TYPE clearway_cache_total counter')
    add(`clearway_cache_total{result="hit"} ${this.cacheTotal.hit}`)
    add(`clearway_cache_total{result="miss"} ${this.cacheTotal.miss}`)

    add('# HELP clearway_ratelimit_rejected_total Requests rejected by rate limiting.')
    add('# TYPE clearway_ratelimit_rejected_total counter')
    add(`clearway_ratelimit_rejected_total ${this.rateLimitRejected}`)

    add('# HELP clearway_build_info Build metadata.')
    add('# TYPE clearway_build_info gauge')
    add(`clearway_build_info{version="${version}",commit="${commit}"} 1`)

    return lines.join('\n') + '\n'
  }
}

export const metrics = new Metrics()
