# Deploying Clearway

Clearway is one Next.js app that boots with **zero external services** (in-memory fallbacks).
For a real deployment you want durable telemetry and shared rate-limits, so add a Postgres and
a Redis. This guide covers Vercel (detailed), a VPS with Docker, and generic Node PaaS.

---

## Required environment variables

Only `RESOLVE_HASH_SALT` is mandatory in production — a bad or missing value fails the boot
with a readable message. Everything else is optional but recommended.

| Variable | Needed | Notes |
|---|---|---|
| `RESOLVE_HASH_SALT` | **yes (prod)** | ≥ 32 bytes random. `openssl rand -hex 32` |
| `APP_URL` | yes | Your public origin, e.g. `https://clearway.example` |
| `NODE_ENV` | yes | `production` |
| `TRUSTED_PROXY_COUNT` | yes behind a proxy | Vercel/Nginx/Caddy → `1` |
| `DATABASE_URL` | recommended | Postgres. Without it, health/analytics reset per instance |
| `REDIS_URL` | recommended | Shared cache + rate limits across instances |
| `ADMIN_PASSWORD_HASH` | for admin | `echo -n 'pw' \| npm run admin:hash` |
| `ADMIN_SESSION_SECRET` | for admin | ≥ 32 bytes random |
| `METRICS_TOKEN` | optional | Gates `/api/metrics` |
| `RESOLVE_TIMEOUT_MS` | optional | Keep below the platform's function timeout |

Full reference: [`.env.example`](.env.example) and [`docs/09-deployment-operations.md`](docs/09-deployment-operations.md).

---

## Option A — Vercel (fastest, `git push` = deploy)

Vercel runs functions serverlessly, so the in-memory store/cache reset between invocations.
**You must attach an external Postgres and Redis.** Free tiers that work out of the box:
**Neon** (Postgres) and **Upstash** (Redis).

### 1. Create the data services

Postgres — pick **one**:

- **Neon** → create a project → copy the connection string. It already includes
  `?sslmode=require` (needed — `pg` uses it to enable TLS).
  Example: `postgres://user:pass@ep-xxx.aws.neon.tech/clearway?sslmode=require`
- **Supabase** → see [Using Supabase for Postgres](#using-supabase-for-postgres) below — it is
  just Postgres and plugs straight into `DATABASE_URL`, with one pooler-vs-direct nuance.

Redis:

- **Upstash** → create a Redis database → copy the **`rediss://`** (TLS) connection URL.
  `ioredis` connects over TCP; Upstash supports the `EVAL` the rate limiter needs.
  (Supabase has no Redis, so you still need Upstash — or skip Redis and accept per-instance
  rate limits, which is a poor fit for serverless.)

### 2. Run migrations once (Vercel does not run them for you)

From your machine, point at Neon and apply the schema:

```bash
DATABASE_URL='postgres://...neon.tech/clearway?sslmode=require' npm run migrate
```

(Or paste the two files in [`migrations/`](migrations/) into Neon's SQL editor.)

### 3. Import the repo in Vercel

- New Project → import this Git repo. Framework autodetects as **Next.js**; leave build and
  output settings default.

### 4. Set environment variables (Project → Settings → Environment Variables)

```
RESOLVE_HASH_SALT     = <openssl rand -hex 32>
APP_URL               = https://<your-project>.vercel.app
NODE_ENV              = production
TRUSTED_PROXY_COUNT   = 1
DATABASE_URL          = <Neon connection string>
REDIS_URL             = <Upstash rediss:// url>
RESOLVE_TIMEOUT_MS    = 25000            # stay under the 30s function cap
# Optional admin:
ADMIN_PASSWORD_HASH   = <npm run admin:hash>
ADMIN_SESSION_SECRET  = <openssl rand -hex 32>
```

### 5. Deploy

Push to your default branch (or hit **Deploy**). Done. Update `APP_URL` to your final domain
once you attach one.

### Vercel notes

- The resolve route sets `maxDuration = 30`; keep `RESOLVE_TIMEOUT_MS` below it (25000 is safe)
  so the engine returns a partial result before the platform kills the function.
- API routes run on the Node.js runtime (required for the SSRF guard's DNS + direct-IP
  connect). The middleware runs on the Edge runtime and only sets headers — both are fine.
- Re-run `npm run migrate` against Neon whenever you add a migration.

### Verify after deploy

```bash
curl -s https://<domain>/api/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<domain>/api/v1/resolve \
  -H 'content-type: application/json' -d '{"url":"http://169.254.169.254/"}'   # must be 403
```

---

## Using Supabase for Postgres

Supabase is plain PostgreSQL — Clearway talks to it with raw `pg`, so no Supabase client SDK
or auth is involved. It plugs into `DATABASE_URL` like any Postgres. There is **one nuance**
that matters, because of connection pooling.

Supabase gives you several connection strings under **Project → Settings → Database**:

| String | Port | Use it for |
|---|---|---|
| **Direct connection** | 5432 | **Migrations** (and any VPS / long-lived process) |
| **Transaction pooler** | 6543 | **The app on serverless** (Vercel) |
| **Session pooler** | 5432 | Alternative for long-lived pooled connections |

Why the split: `npm run migrate` takes a `pg_advisory_lock`, which needs a real session and
does **not** work through the transaction pooler (port 6543). So:

- **Run migrations against the direct connection (5432):**
  ```bash
  DATABASE_URL='postgres://postgres:<pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require' \
    npm run migrate
  ```
- **Point the deployed app at the transaction pooler (6543)** in your Vercel env:
  ```
  DATABASE_URL = postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
  ```

Notes:
- Keep `?sslmode=require` in the string — Supabase requires TLS and `pg` reads that flag.
- On a **VPS / Docker** (long-lived process, not serverless) you can just use the **direct
  connection (5432)** for both migrations and the app; no pooler needed.
- Clearway's queries are single-round-trip parameterised statements, which the transaction
  pooler handles fine — only the migration advisory lock needs the direct connection.
- Supabase is Postgres only; for `REDIS_URL` still use Upstash (or omit Redis and accept
  per-instance limits).

---

## Option B — VPS with Docker (most control)

Everything is prewired in [`docker-compose.yml`](docker-compose.yml) (app + Postgres + Redis,
migrations run automatically).

```bash
git clone <repo> && cd ByPass
printf 'RESOLVE_HASH_SALT=%s\n' "$(openssl rand -hex 32)" > .env   # add APP_URL etc.
docker compose up --build -d
```

Put TLS in front with Caddy (automatic HTTPS):

```
# /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}
```

Set `TRUSTED_PROXY_COUNT=1` in `.env` since Caddy is the proxy.

---

## Option C — Node PaaS (Railway, Render, Fly.io)

1. New app from the repo. Build: `npm run build`. Start: `npm start`.
2. Add the platform's managed Postgres + Redis add-ons → `DATABASE_URL` / `REDIS_URL`.
3. Set the env vars from the table above.
4. Add a release/deploy hook that runs `npm run migrate` before the new version serves.

---

## Pre-launch checklist (all platforms)

- [ ] `RESOLVE_HASH_SALT` and `ADMIN_SESSION_SECRET` are unique and ≥ 32 bytes
- [ ] HTTPS on; the app already sends HSTS
- [ ] `TRUSTED_PROXY_COUNT` matches your real proxy depth (wrong value = rate-limit bypass)
- [ ] Migrations applied against the production database
- [ ] `POST /api/v1/resolve` with `http://169.254.169.254/` returns **403**
- [ ] `/api/metrics` is token-gated or network-restricted

Full model: [`docs/07-security.md`](docs/07-security.md) §11.
