-- 0001_init.sql — resolutions telemetry table, indexes, and the health view.
-- Forward-only. See docs/05-data-model.md.

CREATE TABLE IF NOT EXISTS resolutions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id       TEXT        NOT NULL,
  source_hash      CHAR(64)    NOT NULL,
  source_host      TEXT        NOT NULL,
  destination_host TEXT,
  adapter_id       TEXT,
  category         TEXT,
  status           TEXT        NOT NULL,
  error_code       TEXT,
  hops             SMALLINT    NOT NULL DEFAULT 0,
  duration_ms      INTEGER     NOT NULL,
  cached           BOOLEAN     NOT NULL DEFAULT FALSE,
  client_hash      CHAR(64),
  chain            JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resolutions_created_at_idx   ON resolutions (created_at DESC);
CREATE INDEX IF NOT EXISTS resolutions_adapter_time_idx ON resolutions (adapter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resolutions_status_time_idx  ON resolutions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS resolutions_source_hash_idx  ON resolutions (source_hash);

CREATE OR REPLACE VIEW adapter_health_24h AS
SELECT
  adapter_id,
  count(*)                                                                AS samples,
  count(*) FILTER (WHERE status IN ('resolved','already-direct'))          AS successes,
  round(
    count(*) FILTER (WHERE status IN ('resolved','already-direct'))::numeric
    / NULLIF(count(*), 0), 4)                                             AS success_rate,
  percentile_disc(0.50) WITHIN GROUP (ORDER BY duration_ms)                AS p50_ms,
  percentile_disc(0.95) WITHIN GROUP (ORDER BY duration_ms)                AS p95_ms,
  max(created_at)                                                         AS last_seen_at
FROM resolutions
WHERE created_at > now() - INTERVAL '24 hours'
  AND adapter_id IS NOT NULL
GROUP BY adapter_id;
