# 09 — Deployment & operations

## 1. Environments

| Env | Purpose | Data | External deps |
|---|---|---|---|
| Local | Development | In-memory fallbacks | None required |
| CI | Gates | Ephemeral Postgres + Redis in the Actions runner | Containers |
| Staging | Pre-prod verification | Postgres + Redis | Managed |
| Production | Live | Postgres (+ replica) + Redis | Managed |

The defining property: **local and CI need nothing external to boot.** `npm run dev` with an
empty environment starts, serves, and resolves — using the in-memory store, cache, and limiter.
This keeps the contributor loop instant and makes the fallback paths permanently tested rather
than theoretical.

## 2. Configuration

All configuration is environment variables, parsed once through a Zod schema in
`src/lib/env.ts`. A missing or malformed required variable fails the boot with a readable
message. Full reference in [`.env.example`](../.env.example).

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `development` | `production` in prod, always |
| `PORT` | no | `3000` | |
| `APP_URL` | prod | — | Canonical origin; used for metadata, sitemap, CSP |
| `DATABASE_URL` | no | — | Unset → in-memory store |
| `REDIS_URL` | no | — | Unset → in-memory cache + limiter |
| `RESOLVE_HASH_SALT` | **prod** | dev-only value | ≥ 32 bytes. Rotating it anonymises history |
| `ADMIN_PASSWORD_HASH` | no | — | Unset → admin routes return 404 |
| `ADMIN_SESSION_SECRET` | if admin | — | ≥ 32 bytes |
| `METRICS_TOKEN` | no | — | Unset → `/api/metrics` open (restrict by network instead) |
| `TRUSTED_PROXY_COUNT` | prod | `0` | Hops of `X-Forwarded-For` to trust |
| `RESOLVE_TIMEOUT_MS` | no | `15000` | |
| `STEP_TIMEOUT_MS` | no | `6000` | |
| `MAX_HOPS` | no | `10` | |
| `MAX_RESPONSE_BYTES` | no | `2097152` | |
| `RATE_LIMIT_RESOLVE` | no | `30` | Per 60 s |
| `CACHE_TTL_SUCCESS_S` | no | `3600` | |
| `CACHE_TTL_FAILURE_S` | no | `60` | |
| `RETENTION_DAYS` | no | `30` | |
| `BLOCKED_HOSTS` | no | — | Comma-separated destination host denylist |
| `EXTRA_ALLOWED_PORTS` | no | — | Beyond 80/443. Use sparingly |
| `LOG_LEVEL` | no | `info` | `debug` exposes full URLs — never in prod |

Secrets come from the platform's secret store (never a committed `.env`), injected at runtime.
`.env.example` documents the shape with placeholder values only.

## 3. Build and run

```bash
npm ci                # exact, lockfile-driven
npm run build         # next build, output: 'standalone'
npm run migrate       # apply pending migrations (deploy step, not boot)
npm start             # node .next/standalone/server.js
```

`next build` with `output: 'standalone'` emits a self-contained server bundle with only the
files it needs, which is what makes the container small.

## 4. Container

Multi-stage, distroless-style final image. Full file at [`Dockerfile`](../Dockerfile).

```
Stage 1  deps     npm ci
Stage 2  build    next build → standalone
Stage 3  runtime  node:20-slim, non-root UID 1001, only standalone output
```

Runtime hardening:

- non-root user, read-only root filesystem, all Linux capabilities dropped;
- no shell, no package manager, no source, no dev dependencies in the final layer;
- `HEALTHCHECK` hitting `/api/health`;
- `NODE_ENV=production`, `NODE_OPTIONS=--max-old-space-size` sized to the container.

`docker compose up` brings the app, Postgres, and Redis up together for a production-shaped
local run.

## 5. Deploy flow

```
push ─▶ CI gates ─▶ build image ─▶ push registry ─▶ migrate ─▶ rolling deploy ─▶ smoke
```

1. **Gates.** typecheck, lint, unit, build, e2e, audit. Any failure stops the line.
2. **Image.** Built once, tagged with the commit SHA. The same artifact promotes through
   staging to production — never rebuilt per environment.
3. **Migrate.** Run as a discrete job before the new image serves traffic. Forward-only and
   backward-compatible with the currently-running version, so a rolling deploy is always safe.
4. **Rolling deploy.** New instances must pass `/api/health?deep=1` readiness before receiving
   traffic. Old instances drain.
5. **Smoke.** Post-deploy: resolve a known link, assert `/status` is `operational`, assert the
   SSRF guard rejects a metadata URL. A failure triggers rollback.

**Rollback** = redeploy the previous image tag. Because migrations are backward-compatible
within a release, the previous version runs against the new schema unchanged.

## 6. Observability

**Logs.** Structured JSON via `pino`, one line per event, `requestId` on every line. Levels:
`error` (needs a human), `warn` (degraded but handled — a fallback engaged, a breaker opened),
`info` (request completed), `debug` (full URLs; off in prod). Ship to any log aggregator; the
format is standard.

**Metrics.** `/api/metrics` in Prometheus text format. The dashboards that matter:

- resolve rate, split by status (the RED "rate" and "errors");
- resolve latency p50/p95/p99 (the RED "duration");
- per-adapter success rate and p95 — *the* operational view;
- open breakers (should be zero; each is an alert);
- cache hit rate (a sudden drop means the cache backend is down and it fell back);
- rate-limit rejections (a spike means abuse or a client bug).

**Traces.** The `requestId` correlates the API log line, the per-hop adapter logs, and the DB
row. That is sufficient tracing for a single-service system; OpenTelemetry export is a
drop-in at the logger if a wider system ever needs it.

## 7. Alerts

| Condition | Severity | Meaning |
|---|---|---|
| `/api/health?deep=1` failing 3× | Page | A hard dependency is down |
| 5xx rate > 2% for 5 min | Page | Something is broken, not just an upstream |
| Any breaker open > 15 min | Ticket | An adapter needs attention |
| Overall success rate < 90% for 10 min | Ticket | Coverage decay or an upstream-wide change |
| Cache hit rate → 0 | Ticket | Redis down; running on the fallback |
| p95 > 8 s for 10 min | Ticket | An upstream is slow; check per-adapter latency |
| Rate-limit rejections 10× baseline | Info | Likely abuse; check source distribution |

The philosophy: page only for things a human must act on *now*. An open breaker is
self-healing by design, so it is a ticket, not a page.

## 8. Runbooks

**An adapter is failing.** `/status` names it. Disable it from the admin dashboard — effective
next request, no deploy. It disappears from `/supported` as `down`. Investigate the upstream
change, fix the adapter, ship, re-enable. If it is a whole-category upstream change, expect
several adapters at once.

**Latency is up.** Check per-adapter p95 on `/status`. One slow adapter drags the tail; the
step timeout caps the damage but the breaker may not have tripped if it is slow-but-succeeding.
Consider lowering `STEP_TIMEOUT_MS` or moving that adapter behind the M4 queue.

**Redis is down.** `warn` logs show the cache/limiter fallback engaged. The app is fine but
now per-instance for limits and cache — hit rate drops, limits are softer across N instances.
Restore Redis; the fallback disengages automatically on reconnect.

**Postgres is down.** Resolves still work (store falls back to memory); health and analytics
are per-instance and reset on restart. `/api/health?deep=1` reports `store` unhealthy so the
LB can route around a truly wedged instance. Restore Postgres; no data migration needed —
telemetry gaps are acceptable, this is not transactional data.

**A malicious destination is being served.** Add its host to `BLOCKED_HOSTS` and redeploy the
config, or use the admin cache purge if it was cached. Resolution then returns `BLOCKED_URL`.

**Suspected SSRF attempt in logs.** Expected and handled — the guard rejects and logs at
`warn` with the (hashed) client. No action unless volume suggests a targeted campaign, in
which case block upstream at the WAF.

## 9. Backup and recovery

`resolutions` is telemetry — losing it costs history, not correctness — so a daily snapshot is
sufficient. `adapter_state` is operator intent and small; back it up with the daily snapshot
and, because it is tiny, keep a longer retention on it. There is no user data to protect,
which is the upside of storing nothing reversible.

RTO: minutes (stateless app, redeploy the image). RPO for telemetry: 24 h, and acceptable.

## 10. Capacity

One 1 vCPU / 512 MB instance handles the v1 target with headroom; resolution is I/O-bound.
Scale horizontally by raising the instance count behind the load balancer — set `REDIS_URL`
first so limits and cache are shared. Postgres is nowhere near a bottleneck at v1 volume
([05 §9](./05-data-model.md) sizing). The first thing to scale is instance count, not database
tier.
