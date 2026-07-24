-- 0002_adapter_state.sql — operator-controlled runtime state per adapter.
-- Rows are created lazily on first use; never swept by retention.

CREATE TABLE IF NOT EXISTS adapter_state (
  adapter_id           TEXT PRIMARY KEY,
  enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
  breaker_state        TEXT        NOT NULL DEFAULT 'closed',
  consecutive_failures INTEGER     NOT NULL DEFAULT 0,
  opened_at            TIMESTAMPTZ,
  last_success_at      TIMESTAMPTZ,
  last_failure_at      TIMESTAMPTZ,
  note                 TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
