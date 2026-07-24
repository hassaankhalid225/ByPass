# 02 — Architecture

## 1. Shape of the system

Clearway is a single deployable Next.js application. One process serves the UI and the API.
Every external dependency is optional and has an in-process fallback, so the system boots and
serves correctly with nothing but Node installed.

```
                        ┌──────────────────────────────────────┐
   Browser / API client │            Edge / CDN                │
        │               │  static assets, RSC payload caching  │
        ▼               └──────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│                        Next.js application                           │
│                                                                      │
│  middleware.ts ── request id · security headers · CSP nonce · IP     │
│        │                                                             │
│        ├── App Router (RSC) ──────────── / · /supported · /status    │
│        │                                 /service/[slug] · /admin    │
│        │                                                             │
│        └── Route Handlers (Node) ─────── /api/v1/* · /api/health     │
│                     │                    /api/metrics                │
│                     ▼                                                │
│           ┌─────────────────────┐                                    │
│           │  Resolver Engine    │  orchestration · budgets · breaker │
│           └─────────┬───────────┘                                    │
│                     ▼                                                │
│           ┌─────────────────────┐                                    │
│           │  Adapter Registry   │  host index · priority · enable    │
│           └─────────┬───────────┘                                    │
│                     ▼                                                │
│           ┌─────────────────────┐                                    │
│           │  Guarded HTTP       │  SSRF guard · size/time caps       │
│           └─────────┬───────────┘                                    │
│                     │                                                │
│   ┌─────────────────┼────────────────────┬──────────────────┐        │
│   ▼                 ▼                    ▼                  ▼        │
│ Cache            Rate limiter        Store              Telemetry    │
│ Redis→memory     Redis→memory        Postgres→memory    logs+metrics │
└──────────────────────────────────────────────────────────────────────┘
                     │
                     ▼  the only egress path
                 Public internet
```

## 2. Layers and their contracts

| Layer | Directory | Responsibility | Must not |
|---|---|---|---|
| Presentation | `src/app`, `src/components` | Render, capture input, present results | Contain resolution logic or call `fetch` on third-party hosts |
| Transport | `src/app/api` | Parse, validate, authorise, shape responses, set headers | Contain business logic |
| Domain | `src/server/resolver` | Orchestrate resolution, enforce budgets, select adapters | Know about HTTP frameworks, React, or SQL |
| Infrastructure | `src/server/store`, `src/server/cache`, `src/lib/http` | Persistence, caching, guarded egress | Make product decisions |
| Cross-cutting | `src/lib` | Logging, errors, env, URL utilities | Import from `src/app` |

Dependencies point inward only. The domain layer imports nothing from `src/app`. This is what
makes the engine unit-testable with no server running, and it is enforced by the lint config.

## 3. The resolution pipeline

A single `POST /api/v1/resolve` walks this path:

```
 1  Middleware      request id, IP extraction, security headers
 2  Handler         Zod parse of the body  ─── fail ──▶ 400 VALIDATION_ERROR
 3  Rate limiter    sliding window on hashed IP ─ fail ──▶ 429 RATE_LIMITED
 4  Normalise       scheme, host lowercase, tracking params, unicode → punycode
 5  SSRF guard      scheme allowlist, host denylist, DNS resolve, IP range check
 6  Cache read      hit ──▶ return cached envelope, cached: true, ~5 ms
 7  Engine
      loop until terminal or budget exhausted:
        a  select adapter  (host index → generic chain, by priority)
        b  breaker open?   skip adapter, record skip
        c  adapter.resolve(ctx)  under per-step timeout
        d  record hop, feed output back as next input
 8  Terminal        no adapter claims the URL, or max depth reached
 9  Persist         resolution record (URL hashed), adapter health counters
10  Cache write     TTL by outcome: success 1 h, failure 60 s
11  Respond         200 envelope + rate-limit headers + request id
```

Every step has a budget. The whole request is capped by `RESOLVE_TIMEOUT_MS`; each hop by
`STEP_TIMEOUT_MS`; the chain by `MAX_HOPS`; the response body by `MAX_RESPONSE_BYTES`. A
budget breach is a typed error, not a hang.

## 4. Adapter selection

The registry keeps two structures:

- **Host index** — `Map<hostname, Adapter[]>` built once at startup from each adapter's
  `hosts` declaration. Exact match, then progressive parent-domain match, so
  `cdn.example.com` finds an adapter registered for `example.com`.
- **Generic chain** — adapters with no host declaration that expose `canHandle(url, ctx)`,
  sorted by descending priority.

Selection tries the host index first. If nothing claims the URL, the generic chain is tried in
priority order and the first `canHandle` wins. If nothing claims it and the URL is already a
plain destination, the engine terminates successfully — "already unwrapped" is a valid answer.

## 5. Failure model

Nothing in this system is allowed to fail globally because one thing failed locally.

| Failure | Behaviour |
|---|---|
| Redis unreachable | Cache and limiter transparently fall back to in-process LRU/counter maps. Logged once at warn, not per request |
| PostgreSQL unreachable | Store falls back to a bounded in-memory ring buffer. Health and analytics still work for the current process |
| One adapter throws | Hop recorded as failed, breaker counter incremented, engine continues with the next candidate |
| Adapter fails N times consecutively | Breaker opens for a cooldown; the adapter is skipped and reported degraded on `/status` |
| Upstream slow | Step timeout aborts via `AbortSignal`; partial chain returned with a `TIMEOUT` terminal reason |
| Upstream huge | Body read is capped mid-stream and aborted |
| Redirect loop | Visited-set detection returns `LOOP_DETECTED` with the chain that proves it |

## 6. Caching strategy

| Layer | Key | TTL | Invalidation |
|---|---|---|---|
| Resolution cache | `resolve:v1:<sha256(normalised url)>` | 3600 s success / 60 s failure | TTL only |
| Adapter health | `health:<adapter id>` | rolling 24 h window | Sliding |
| Static pages | Next.js full route cache | build-time | Deploy |
| `/supported`, `/status` | RSC with `revalidate` | 60 s | Time-based |

Failures are cached deliberately but briefly — it stops a hot broken link from hammering an
upstream, without freezing a fix out for an hour.

## 7. Data flow and privacy

Raw URLs are used in memory during a request and are never written to durable storage. What
persists is `sha256(url + RESOLVE_HASH_SALT)`, enough to count and deduplicate but not to
reverse. Client IPs follow the same rule for rate-limit keys and analytics.

Cache values do contain the destination URL — that is the point of the cache — but they live
in a TTL-bounded store, not a durable one.

## 8. Rendering strategy

| Route | Strategy | Reason |
|---|---|---|
| `/` | Static shell + client island | The form is the only interactive part; ship the smallest possible JS |
| `/supported` | Server-rendered, `revalidate: 60` | Registry-derived, changes rarely, needs live health |
| `/service/[slug]` | `generateStaticParams` from the registry | Indexable per-service landing pages |
| `/status` | Server-rendered, `revalidate: 30`, `dynamic` | Must be current |
| `/about`, `/privacy`, `/terms`, `/faq` | Fully static | Prose |
| `/admin/*` | Dynamic, `noindex`, auth-gated | Never cached |

The home page ships one client component tree: the form, the lane visualisation, the result
card, and the local history list. Everything else is a server component.

## 9. Extension points

1. **Adapters** — implement `ResolverAdapter`, add one line to the registry. Full contract in
   [06](./06-resolver-engine.md).
2. **Cache / limiter drivers** — implement `CacheDriver` / `RateLimiterDriver`; swap by env.
3. **Store drivers** — implement `Store`; the Postgres and memory drivers are the reference.
4. **Telemetry sinks** — the logger is a single module; point it at any transport.

## 10. Scaling path

Single process handles the v1 load target comfortably; resolution is I/O-bound and Node's
event loop is the right shape for it. When one process is not enough:

1. Set `REDIS_URL`. Cache and rate limits become shared, so N instances behave as one.
2. Run N stateless instances behind a load balancer. No sticky sessions — there is no session.
3. Move slow adapters behind a queue (`M4`), so a 20 s adapter cannot occupy a request slot.
4. Read replicas for the store; analytics reads are already isolated from the write path.

The only genuinely stateful component is PostgreSQL, and it is not on the critical path for a
resolve.

## 11. Key decisions

Recorded as ADRs in [`docs/adr/`](./adr/):

- [0001 — Next.js App Router as a single deployable](./adr/0001-nextjs-single-deployable.md)
- [0002 — Plugin-based resolver engine](./adr/0002-plugin-resolver-engine.md)
- [0003 — `pg` and raw SQL instead of an ORM](./adr/0003-raw-sql-over-orm.md)
- [0004 — Every dependency optional with an in-process fallback](./adr/0004-optional-dependencies.md)
- [0005 — Lawful resolver scope](./adr/0005-lawful-resolver-scope.md)
