# 04 — API specification, v1

Base URL: `{origin}/api/v1`
Content type: `application/json; charset=utf-8`
Versioning: in the path. v1 is additive-only after release — no field is ever removed or
retyped. Breaking changes ship as `/api/v2`.

## 1. Response envelope

Every endpoint returns the same shape. Clients branch on `ok`.

```jsonc
// success
{ "ok": true,  "data": { /* endpoint payload */ }, "requestId": "r_2f8a1c9e4b7d" }

// failure
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "Too many requests.",
                          "details": { "retryAfter": 42 } },
  "requestId": "r_2f8a1c9e4b7d" }
```

`requestId` is on every response and every log line. It is the only thing support needs.

## 2. Common headers

**Request**

| Header | Required | Notes |
|---|---|---|
| `Content-Type: application/json` | on POST | Anything else is `415` |
| `X-Request-Id` | no | Echoed back if supplied and it matches `^[A-Za-z0-9_-]{1,64}$` |

**Response**

| Header | Meaning |
|---|---|
| `X-Request-Id` | Correlation id |
| `X-RateLimit-Limit` | Requests allowed in the window |
| `X-RateLimit-Remaining` | Requests left |
| `X-RateLimit-Reset` | Unix seconds when the window resets |
| `Retry-After` | Seconds. Present on `429` and `503` |
| `Cache-Control` | `no-store` on `/resolve`, `public, max-age=60` on registry reads |

## 3. Error codes

| Code | HTTP | Meaning | Client action |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Body failed schema validation | Fix the payload; `details.fields` lists offenders |
| `INVALID_URL` | 400 | Not parseable as an absolute http/https URL | Fix the URL |
| `BLOCKED_URL` | 403 | Target is private, reserved, loopback, or denylisted | Do not retry |
| `UNSUPPORTED_URL` | 422 | No adapter claimed it and it is not already a destination | Report the service |
| `RATE_LIMITED` | 429 | Window exhausted | Back off for `details.retryAfter` seconds |
| `UPSTREAM_ERROR` | 502 | Target host returned an unusable response | Retry once with backoff |
| `UPSTREAM_TIMEOUT` | 504 | Step or total budget exceeded | Retry once |
| `LOOP_DETECTED` | 422 | The chain revisited a URL | Do not retry |
| `MAX_HOPS_EXCEEDED` | 422 | Chain exceeded `MAX_HOPS` | Do not retry |
| `ADAPTER_DISABLED` | 503 | The only matching adapter is off or its breaker is open | Retry later; check `/status` |
| `PAYLOAD_TOO_LARGE` | 413 | Request body over 8 KB | Fix the payload |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong `Content-Type` | Send JSON |
| `METHOD_NOT_ALLOWED` | 405 | — | — |
| `UNAUTHORIZED` | 401 | Admin endpoint without a valid session | Sign in |
| `INTERNAL_ERROR` | 500 | Unexpected. Details are logged, never returned | Report with the `requestId` |

Error messages are written for a human reading a terminal. They never contain stack traces,
file paths, SQL, or upstream response bodies.

---

## 4. `POST /api/v1/resolve`

Resolve a wrapped URL to its destination.

**Rate limit:** 30 requests / 60 s per client, sliding window.

### Request

```json
{
  "url": "https://bit.ly/3xAmPle",
  "options": { "maxHops": 10, "includeChain": true, "noCache": false }
}
```

| Field | Type | Default | Constraints |
|---|---|---|---|
| `url` | string | — | 1–2048 chars. Scheme optional; `https://` is assumed |
| `options.maxHops` | integer | 10 | 1–20, clamped to the server maximum |
| `options.includeChain` | boolean | true | `false` omits `chain` from the response |
| `options.noCache` | boolean | false | Bypasses the cache read. The write still happens |

### Response `200`

```json
{
  "ok": true,
  "requestId": "r_2f8a1c9e4b7d",
  "data": {
    "status": "resolved",
    "source": "https://bit.ly/3xAmPle",
    "destination": "https://example.com/downloads/build-2024.zip",
    "hops": 3,
    "cached": false,
    "durationMs": 812,
    "resolvedAt": "2026-07-24T09:31:44.201Z",
    "service": { "id": "bitly", "name": "Bitly", "category": "shortener" },
    "chain": [
      { "step": 1, "url": "https://bit.ly/3xAmPle",
        "adapter": "bitly", "method": "redirect", "statusCode": 301, "durationMs": 210 },
      { "step": 2, "url": "https://tracker.example.net/out?u=…",
        "adapter": "params-resolver", "method": "query-param", "statusCode": 200, "durationMs": 340 },
      { "step": 3, "url": "https://example.com/downloads/build-2024.zip",
        "adapter": null, "method": "terminal", "statusCode": null, "durationMs": 0 }
    ],
    "warnings": []
  }
}
```

| `status` | Meaning |
|---|---|
| `resolved` | A different destination was reached |
| `already-direct` | The input was already a destination; `chain` has one entry |
| `partial` | Budget ran out mid-chain. `destination` is the furthest hop reached; `warnings` explains |

`chain[].method` is one of `redirect`, `meta-refresh`, `query-param`, `base64-payload`,
`html-extract`, `api`, `terminal`.

### Errors

`400 VALIDATION_ERROR` · `400 INVALID_URL` · `403 BLOCKED_URL` · `422 UNSUPPORTED_URL` ·
`422 LOOP_DETECTED` · `422 MAX_HOPS_EXCEEDED` · `429 RATE_LIMITED` · `502 UPSTREAM_ERROR` ·
`504 UPSTREAM_TIMEOUT`

### Examples

```bash
curl -sS https://clearway.example/api/v1/resolve \
  -H 'content-type: application/json' \
  -d '{"url":"bit.ly/3xAmPle"}' | jq
```

```ts
const res = await fetch('/api/v1/resolve', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url }),
})
const body = await res.json()
if (!body.ok) throw new Error(`${body.error.code}: ${body.error.message}`)
console.log(body.data.destination)
```

---

## 5. `GET /api/v1/supported`

The service registry, as rendered on `/supported`.

**Rate limit:** 120 / 60 s. **Cache:** `public, max-age=60, stale-while-revalidate=300`.

### Query

| Param | Type | Notes |
|---|---|---|
| `category` | enum | `ad-gate` · `social-gate` · `shortener` · `paste` · `generic` |
| `q` | string | ≤ 64 chars. Matches name, slug, and domains |

### Response `200`

```json
{
  "ok": true,
  "requestId": "r_…",
  "data": {
    "total": 62,
    "categories": [
      { "id": "shortener", "label": "Link shorteners", "count": 12 }
    ],
    "services": [
      { "id": "bitly", "slug": "bitly", "name": "Bitly", "category": "shortener",
        "domains": ["bit.ly", "bitly.com"], "status": "operational",
        "successRate": 0.994, "enabled": true }
    ]
  }
}
```

`status` is `operational` (≥ 90% over 24 h), `degraded` (50–90%, or breaker half-open), or
`down` (< 50%, breaker open, or manually disabled). With no traffic in the window a service
reports `operational` with `successRate: null`.

---

## 6. `GET /api/v1/status`

System and per-adapter health, as rendered on `/status`.

**Rate limit:** 60 / 60 s. **Cache:** `public, max-age=30`.

```json
{
  "ok": true,
  "requestId": "r_…",
  "data": {
    "status": "operational",
    "generatedAt": "2026-07-24T09:31:44.201Z",
    "window": "24h",
    "summary": { "resolutions": 18422, "successRate": 0.981,
                 "p50Ms": 640, "p95Ms": 3120, "cacheHitRate": 0.41 },
    "adapters": [
      { "id": "bitly", "name": "Bitly", "status": "operational",
        "successRate": 0.994, "samples": 1204, "p95Ms": 410,
        "breaker": "closed", "lastFailureAt": null }
    ]
  }
}
```

Top-level `status` is `operational`, `degraded` (any adapter down, or success rate < 95%), or
`down` (success rate < 50%, or a hard dependency failing readiness).

---

## 7. `GET /api/health`

Unauthenticated. Excluded from rate limiting. For load balancers and uptime checks.

| Query | Behaviour |
|---|---|
| *(none)* | Liveness. Always `200` if the process is up |
| `?deep=1` | Readiness. Pings cache and store. `503` if a configured dependency is unreachable |

```json
{ "status": "ok", "uptimeSeconds": 84021, "version": "1.0.0", "commit": "a1b2c3d",
  "checks": { "cache": { "status": "ok", "driver": "redis", "latencyMs": 2 },
              "store": { "status": "ok", "driver": "postgres", "latencyMs": 4 } } }
```

Note the deliberate exception: `/api/health` does **not** use the standard envelope, because
load balancers and uptime monitors expect a flat document.

---

## 8. `GET /api/metrics`

Prometheus text exposition. Gated by `METRICS_TOKEN` when set (`Authorization: Bearer …`).

```
clearway_resolve_total{status="success"} 18422
clearway_resolve_total{status="failure"} 356
clearway_resolve_duration_ms_bucket{le="500"} 9210
clearway_adapter_total{adapter="bitly",status="success"} 1197
clearway_adapter_breaker_open{adapter="lootlinks"} 1
clearway_cache_total{result="hit"} 7551
clearway_ratelimit_rejected_total 88
clearway_build_info{version="1.0.0",commit="a1b2c3d"} 1
```

---

## 9. Admin endpoints

All require a valid `clearway_admin` session cookie. All are `no-store` and `noindex`.
Sign-in is rate-limited to **5 attempts / 15 min** per IP, with a constant-time password
comparison and a uniform error message regardless of failure reason.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/admin/session` | Sign in. Body `{ password }`. Sets the cookie |
| `DELETE` | `/api/v1/admin/session` | Sign out. Clears the cookie |
| `GET` | `/api/v1/admin/adapters` | Adapters with health, traffic, and enabled state |
| `PATCH` | `/api/v1/admin/adapters/{id}` | Body `{ enabled: boolean }`. Runtime toggle, no deploy |
| `POST` | `/api/v1/admin/cache/purge` | Body `{ url? }`. One key, or the whole namespace |

## 10. Client guidance

- **Retries.** Retry only `502`, `503`, `504`, and `429`. Exponential backoff from 1 s, full
  jitter, three attempts maximum. Never retry a `4xx` other than `429`.
- **Idempotency.** `POST /resolve` is safe to repeat — it has no side effect beyond counters.
- **Timeouts.** Set a client timeout of 15 s. The server budget is lower; anything longer is
  a network problem, not a resolve.
- **Do not scrape the registry per request.** `/supported` changes on the order of days.
