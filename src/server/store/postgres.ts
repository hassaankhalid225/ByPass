import type { Pool } from 'pg'
import type {
  AdapterHealth,
  AdapterStateRow,
  ResolutionRecord,
  Store,
  SystemSummary,
} from './types'

/**
 * PostgreSQL store. Every statement is parameterised through $N placeholders —
 * there is no string concatenation into SQL anywhere in this file, and a lint rule
 * bans template literals in query(). See docs/07-security.md §6 and ADR-0003.
 */
export class PostgresStore implements Store {
  readonly name = 'postgres' as const
  constructor(private readonly pool: Pool) {}

  async ready(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = performance.now()
    try {
      await this.pool.query('SELECT 1')
      return { ok: true, latencyMs: Math.round(performance.now() - start) }
    } catch {
      return { ok: false, latencyMs: Math.round(performance.now() - start) }
    }
  }

  async recordResolution(r: ResolutionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO resolutions
         (request_id, source_hash, source_host, destination_host, adapter_id,
          category, status, error_code, hops, duration_ms, cached, client_hash, chain, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        r.requestId,
        r.sourceHash,
        r.sourceHost,
        r.destinationHost,
        r.adapterId,
        r.category,
        r.status,
        r.errorCode,
        r.hops,
        r.durationMs,
        r.cached,
        r.clientHash,
        r.chain === null ? null : JSON.stringify(r.chain),
        r.createdAt,
      ],
    )
  }

  async adapterHealth24h(): Promise<AdapterHealth[]> {
    const { rows } = await this.pool.query(
      `SELECT adapter_id, samples, successes, success_rate, p50_ms, p95_ms, last_seen_at
         FROM adapter_health_24h
        ORDER BY adapter_id`,
    )
    return rows.map((row) => ({
      adapterId: row.adapter_id,
      samples: Number(row.samples),
      successes: Number(row.successes),
      successRate: row.success_rate === null ? null : Number(row.success_rate),
      p50Ms: row.p50_ms === null ? null : Number(row.p50_ms),
      p95Ms: row.p95_ms === null ? null : Number(row.p95_ms),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    }))
  }

  async systemSummary24h(): Promise<SystemSummary> {
    const { rows } = await this.pool.query(
      `SELECT
         count(*)                                                          AS resolutions,
         round(count(*) FILTER (WHERE status IN ('resolved','already-direct'))::numeric
               / NULLIF(count(*),0), 4)                                    AS success_rate,
         percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_ms)          AS p50_ms,
         percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)          AS p95_ms,
         round(count(*) FILTER (WHERE cached)::numeric
               / NULLIF(count(*),0), 4)                                    AS cache_hit_rate
       FROM resolutions
       WHERE created_at > now() - INTERVAL '24 hours'`,
    )
    const row = rows[0]
    return {
      resolutions: Number(row.resolutions),
      successRate: row.success_rate === null ? null : Number(row.success_rate),
      p50Ms: row.p50_ms === null ? null : Number(row.p50_ms),
      p95Ms: row.p95_ms === null ? null : Number(row.p95_ms),
      cacheHitRate: row.cache_hit_rate === null ? null : Number(row.cache_hit_rate),
    }
  }

  async getAdapterState(adapterId: string): Promise<AdapterStateRow | null> {
    const { rows } = await this.pool.query(`SELECT * FROM adapter_state WHERE adapter_id = $1`, [
      adapterId,
    ])
    return rows[0] ? mapState(rows[0]) : null
  }

  async listAdapterState(): Promise<AdapterStateRow[]> {
    const { rows } = await this.pool.query(`SELECT * FROM adapter_state ORDER BY adapter_id`)
    return rows.map(mapState)
  }

  async upsertAdapterState(
    adapterId: string,
    patch: Partial<Omit<AdapterStateRow, 'adapterId' | 'updatedAt'>>,
  ): Promise<AdapterStateRow> {
    // Ensure the row exists, then apply the patch. Two small statements keep the
    // dynamic-column problem out of the SQL entirely.
    await this.pool.query(
      `INSERT INTO adapter_state (adapter_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [adapterId],
    )
    const { rows } = await this.pool.query(
      `UPDATE adapter_state SET
         enabled              = COALESCE($2, enabled),
         breaker_state        = COALESCE($3, breaker_state),
         consecutive_failures = COALESCE($4, consecutive_failures),
         opened_at            = CASE WHEN $5::boolean THEN $6 ELSE opened_at END,
         last_success_at      = CASE WHEN $7::boolean THEN $8 ELSE last_success_at END,
         last_failure_at      = CASE WHEN $9::boolean THEN $10 ELSE last_failure_at END,
         note                 = CASE WHEN $11::boolean THEN $12 ELSE note END,
         updated_at           = now()
       WHERE adapter_id = $1
       RETURNING *`,
      [
        adapterId,
        patch.enabled ?? null,
        patch.breakerState ?? null,
        patch.consecutiveFailures ?? null,
        'openedAt' in patch,
        patch.openedAt ?? null,
        'lastSuccessAt' in patch,
        patch.lastSuccessAt ?? null,
        'lastFailureAt' in patch,
        patch.lastFailureAt ?? null,
        'note' in patch,
        patch.note ?? null,
      ],
    )
    return mapState(rows[0])
  }
}

function mapState(row: Record<string, unknown>): AdapterStateRow {
  return {
    adapterId: row.adapter_id as string,
    enabled: row.enabled as boolean,
    breakerState: row.breaker_state as AdapterStateRow['breakerState'],
    consecutiveFailures: Number(row.consecutive_failures),
    openedAt: row.opened_at ? new Date(row.opened_at as string) : null,
    lastSuccessAt: row.last_success_at ? new Date(row.last_success_at as string) : null,
    lastFailureAt: row.last_failure_at ? new Date(row.last_failure_at as string) : null,
    note: (row.note as string | null) ?? null,
    updatedAt: new Date(row.updated_at as string),
  }
}
