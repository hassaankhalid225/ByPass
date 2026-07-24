# 05 — Data model

PostgreSQL 16. Two tables and one view. The schema is deliberately small: the store is not on
the critical path of a resolve, it exists to answer health and analytics questions.

## 1. Privacy constraints that shape the schema

Two rules drive every column choice:

1. **No raw URLs at rest.** A URL is a secret — it may contain tokens, invite codes, or
   identifying paths. We store `sha256(normalised_url || RESOLVE_HASH_SALT)`, which supports
   counting and deduplication but not reversal.
2. **No raw IPs at rest.** Same treatment with the same salt. Rotating the salt severs the
   link between historical rows and any current client.

Only the destination *host* is stored, never the destination path or query. That is enough to
detect malware-host patterns and to power "top destinations", without retaining the link.

## 2. `resolutions`

One row per resolution attempt. Append-only; nothing updates it.

```sql
CREATE TABLE resolutions (
  id              BIGGENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id      TEXT        NOT NULL,
  source_hash     CHAR(64)    NOT NULL,
  source_host     TEXT        NOT NULL,
  destination_host TEXT,
  adapter_id      TEXT,
  category        TEXT,
  status          TEXT        NOT NULL,
  error_code      TEXT,
  hops            SMALLINT    NOT NULL DEFAULT 0,
  duration_ms     INTEGER     NOT NULL,
  cached          BOOLEAN     NOT NULL DEFAULT FALSE,
  client_hash     CHAR(64),
  chain           JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Notes |
|---|---|
| `request_id` | Joins a row to its log lines. The only support handle |
| `source_hash` | Salted SHA-256 of the normalised input URL |
| `source_host` | Registrable host only, for grouping by service |
| `destination_host` | Host of the destination. `NULL` on failure |
| `adapter_id` | The adapter that produced the terminal hop. `NULL` for `already-direct` |
| `status` | `resolved` · `already-direct` · `partial` · `failed` |
| `error_code` | The API error code on failure. `NULL` otherwise |
| `chain` | The hop array with URLs already stripped to host + method + status |
| `client_hash` | Salted SHA-256 of the client IP. Nullable so it can be dropped entirely |

**Indexes**

```sql
CREATE INDEX resolutions_created_at_idx   ON resolutions (created_at DESC);
CREATE INDEX resolutions_adapter_time_idx ON resolutions (adapter_id, created_at DESC);
CREATE INDEX resolutions_status_time_idx  ON resolutions (status, created_at DESC);
CREATE INDEX resolutions_source_hash_idx  ON resolutions (source_hash);
```

`adapter_id, created_at DESC` is the workhorse — the health rollup for `/status` is a per-
adapter aggregate over the last 24 h and this index makes it an index-only-ish range scan.

**Partitioning.** Not in v1. At sustained volume, range-partition monthly on `created_at`;
retention then becomes `DROP PARTITION` instead of a delete sweep. The schema is already
partition-compatible (`created_at` in every index prefix or suffix).

## 3. `adapter_state`

Runtime, operator-controlled state. Small, mutable, read on every request through a
short-TTL cache.

```sql
CREATE TABLE adapter_state (
  adapter_id       TEXT PRIMARY KEY,
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  breaker_state    TEXT        NOT NULL DEFAULT 'closed',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  opened_at        TIMESTAMPTZ,
  last_success_at  TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ,
  note             TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`breaker_state` is `closed` · `open` · `half-open`. The row is created lazily on first use via
`INSERT … ON CONFLICT DO NOTHING`, so a newly added adapter needs no migration.

`note` lets an operator record *why* something is disabled. It is shown in the admin UI and
never exposed publicly.

## 4. `adapter_health_24h` (view)

The `/status` payload, as one query.

```sql
CREATE VIEW adapter_health_24h AS
SELECT
  adapter_id,
  count(*)                                                     AS samples,
  count(*) FILTER (WHERE status IN ('resolved','already-direct')) AS successes,
  round(
    count(*) FILTER (WHERE status IN ('resolved','already-direct'))::numeric
    / NULLIF(count(*), 0), 4)                                  AS success_rate,
  percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_ms)     AS p50_ms,
  percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)     AS p95_ms,
  max(created_at)                                              AS last_seen_at
FROM resolutions
WHERE created_at > now() - INTERVAL '24 hours'
  AND adapter_id IS NOT NULL
GROUP BY adapter_id;
```

A plain view, not materialised. At v1 volumes the aggregate is single-digit milliseconds
behind the index, and the RSC page caches it for 30 s anyway. Promote to a materialised view
refreshed on a schedule when `samples` per day exceeds ~10⁷.

## 5. Retention

`RETENTION_DAYS` (default 30) governs `resolutions`. The sweep is a bounded, repeatable
delete — safe to run from cron, a scheduled task, or a container sidecar:

```sql
DELETE FROM resolutions
WHERE created_at < now() - ($1 || ' days')::INTERVAL
LIMIT 10000;
```

Run it in a loop until it deletes zero rows. Bounded batches keep it off the autovacuum's toes
and out of a long lock.

`adapter_state` is never swept — it is operator intent, not telemetry.

## 6. Migrations

Numbered, forward-only SQL files in `migrations/`, applied by `scripts/migrate.mjs`.

```
migrations/
  0001_init.sql
  0002_adapter_state.sql
```

The runner:

1. takes `pg_advisory_lock(hashtext('clearway_migrations'))` so concurrent boots cannot race,
2. creates `schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)` if absent,
3. applies every unapplied file in lexical order, each inside its own transaction,
4. releases the lock.

Migrations run as a **deploy step**, never on application boot. An application instance that
finds an unexpected schema fails readiness rather than mutating the database.

Rules: forward-only, additive within a release, and every destructive change split across two
releases (stop writing → deploy → drop).

## 7. Fallback driver

When `DATABASE_URL` is unset the store uses a bounded in-memory ring buffer (default 10 000
records) behind the identical `Store` interface. Health and metrics work; they simply reset
with the process and are per-instance. This is what lets `npm run dev` work with no services
running, and it is exercised by the test suite so it cannot rot.

## 8. Client-side storage

Recent resolutions live in `localStorage` under `clearway:history:v1` — an array of at most 20
`{ source, destination, resolvedAt }`. It never leaves the device and there is no server-side
counterpart. Bump the `:v1` suffix to invalidate on a shape change.

## 9. Sizing

At 100 000 resolutions/day with `chain` averaging ~400 bytes:

| | |
|---|---|
| Row size incl. TOAST and index overhead | ~700 B |
| Per day | ~70 MB |
| At 30-day retention, steady state | ~2.1 GB |
| Indexes | ~35% of heap, ~700 MB |
| **Total** | **~3 GB** |

Comfortable on the smallest managed instance available anywhere.
