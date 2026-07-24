# 06 — Resolver engine

The engine is the product. Everything else is delivery.

## 1. Model

A resolution is a **walk over a directed graph of URLs**. Each node is a URL; each edge is one
adapter turning a URL into the next URL. The walk ends when no adapter claims the current node
(terminal — that is the destination) or when a budget is exhausted.

```
source ──[bitly]──▶ tracker ──[params-resolver]──▶ paste ──[pastebin]──▶ destination
   n1                  n2                            n3                     n4
```

Framing it this way buys three things for free: the chain is inherently explainable, loop
detection is a visited set, and a new capability is a new edge type — never a change to the
walk.

## 2. The adapter contract

```ts
export interface ResolverAdapter {
  /** Stable identifier. Used in metrics, the DB, and the admin UI. Never rename. */
  readonly id: string
  readonly name: string
  readonly category: ServiceCategory
  /** Hostnames this adapter claims. Matched exactly, then by parent domain. */
  readonly hosts?: readonly string[]
  /** Higher wins when several adapters claim the same URL. Default 0. */
  readonly priority?: number
  /** Public listing on /supported. Generic techniques set false. */
  readonly listed?: boolean
  readonly description?: string

  /** Cheap, synchronous-ish predicate. Must not perform network I/O. */
  canHandle(url: URL, ctx: ResolveContext): boolean

  /** Perform one hop. Exactly one edge, never a loop of its own. */
  resolve(url: URL, ctx: ResolveContext): Promise<AdapterResult>
}

export type AdapterResult =
  | { kind: 'next';     url: string; method: HopMethod; statusCode?: number; note?: string }
  | { kind: 'terminal'; url: string; method: HopMethod; statusCode?: number; note?: string }
  | { kind: 'skip';     reason: string }
  | { kind: 'error';    code: ErrorCode; message: string; statusCode?: number }
```

### Rules an adapter must obey

1. **One hop per call.** Return the next URL; the engine loops. An adapter that loops
   internally defeats budgets, loop detection, and the chain display.
2. **Never call `fetch` directly.** Use `ctx.http`. It is the only path through the SSRF
   guard, the size cap, and the timeout, and it is what tests replace.
3. **Never throw for expected outcomes.** Return `{ kind: 'error' }` or `{ kind: 'skip' }`. A
   thrown error is treated as a defect, logged at `error`, and counted against the breaker.
4. **`canHandle` does no I/O.** It runs for every candidate on every hop.
5. **Be idempotent.** The same input must give the same output. The cache assumes it.
6. **Emit absolute URLs.** Resolve relatives against the current URL before returning.

### `ResolveContext`

```ts
export interface ResolveContext {
  readonly http: GuardedHttpClient   // the only egress
  readonly logger: Logger            // pre-bound with requestId and adapterId
  readonly signal: AbortSignal       // total-budget abort
  readonly depth: number             // 0-based hop index
  readonly maxHops: number
  readonly visited: ReadonlySet<string>
  readonly requestId: string
}
```

## 3. Shipped adapters

### Generic techniques — `listed: false`, low priority, tried last

| Adapter | `method` | What it does |
|---|---|---|
| `http-redirect` | `redirect` | Issues `GET` with `redirect: 'manual'` and follows one `Location`. Handles 301/302/303/307/308 and relative targets. The backbone — every plain shortener resolves through it |
| `meta-refresh` | `meta-refresh` | Parses `<meta http-equiv="refresh" content="0;url=…">` from the first 256 KB of HTML |
| `params-resolver` | `query-param` | Extracts a URL from a known wrapper parameter (`url`, `u`, `to`, `dest`, `target`, `redirect`, `link`, `r`, `out`, `goto`, `continue`, `q`). Validates that the value is an absolute http(s) URL before accepting it |
| `base-resolver` | `base64-payload` | Decodes base64 / base64url segments in the path or query and accepts the result if it parses as an absolute http(s) URL |
| `js-location` | `html-extract` | Reads unambiguous `window.location = "…"` / `location.href = "…"` / `location.replace("…")` assignments from inline scripts. Pattern matching only — no script execution, no DOM |
| `canonical-link` | `html-extract` | Falls back to `<link rel="canonical">` when it points to a different origin |

These six cover the entire "plain redirect" long tail without naming a single service, which
is why `/supported` lists a *technique* row rather than fifty near-duplicate rows.

### Named shorteners — `listed: true`

`bitly` · `tinyurl` · `is-gd` · `v-gd` · `rebrandly` · `shortio` · `cuttly` · `tinylink` ·
`google-redirect`

Each declares its hosts, then delegates to the shared redirect strategy. They exist as
separate entries so `/supported` can name them, so health is tracked per service, and so a
service-specific quirk has an obvious home.

### Paste hosts — `listed: true`, `category: 'paste'`

`pastebin` · `rentry` · `justpaste` · `hastebin` · `privatebin` · `controlc` · `pastelink` ·
`dpaste` · `paste-ee`

Each maps a human paste URL to the host's **own documented raw endpoint**
(`pastebin.com/ABC123` → `pastebin.com/raw/ABC123`), fetches it as text, and extracts the
first absolute http(s) URL. `privatebin` is listed but returns `skip` with an explanation:
its payloads are decrypted client-side with a key held in the fragment, which never reaches a
server. Saying so is better than failing silently.

### Extension point — gate adapters

`ad-gate` and `social-gate` categories are registered as **declared but unimplemented**. They
appear on `/supported` with `status: 'unavailable'` and a link to this section.

The engine loads them exactly like any other adapter. Implementing one means dropping a file
into `src/server/resolver/adapters/gates/` and adding a registry line. This repository does
not ship that implementation — see [ADR-0005](./adr/0005-lawful-resolver-scope.md) for the
reasoning. The contract, the health tracking, the breaker, the admin toggle, and the UI slot
are all already in place for an operator who has the standing to add one.

## 4. Selection algorithm

```
selectAdapter(url, ctx):
  candidates = []

  # 1. exact host, then parent domains: a.b.example.com → b.example.com → example.com
  for host in hostChain(url.hostname):
      candidates += hostIndex.get(host) ?? []

  # 2. generic adapters, highest priority first
  candidates += genericChain

  for adapter in candidates sorted by (priority desc, registration order):
      if not enabled(adapter):        continue   # admin toggle
      if breakerOpen(adapter):        continue   # circuit breaker
      if not adapter.canHandle(url):  continue
      return adapter

  return null   # terminal
```

Host-declared adapters always beat generic ones regardless of priority, because a specific
answer is better than a general one. Within a tier, `priority` then registration order decides.

## 5. Budgets

| Budget | Env | Default | On breach |
|---|---|---|---|
| Total wall clock | `RESOLVE_TIMEOUT_MS` | 15 000 | `504 UPSTREAM_TIMEOUT`, partial chain returned |
| Per-hop wall clock | `STEP_TIMEOUT_MS` | 6 000 | Hop marked failed, engine continues |
| Chain length | `MAX_HOPS` | 10 | `422 MAX_HOPS_EXCEEDED` |
| Response body | `MAX_RESPONSE_BYTES` | 2 097 152 | Stream aborted, `502 UPSTREAM_ERROR` |
| Redirects per hop | fixed | 1 | Each redirect is its own visible hop |

The total budget is a single `AbortSignal` threaded through every adapter, so an abort
unwinds the whole tree rather than leaking a socket.

## 6. Circuit breaker

Per adapter, three states:

```
closed ──[N consecutive failures]──▶ open ──[cooldown elapses]──▶ half-open
   ▲                                                                  │
   └──────────────[one success]───────────────────────────────────────┘
                                    │
                       [one failure]─┴──▶ open (cooldown doubles, capped)
```

| Parameter | Env | Default |
|---|---|---|
| Failure threshold | `BREAKER_THRESHOLD` | 5 |
| Base cooldown | `BREAKER_COOLDOWN_MS` | 60 000 |
| Max cooldown | `BREAKER_MAX_COOLDOWN_MS` | 900 000 |

Only *adapter* failures trip the breaker. `BLOCKED_URL` and `VALIDATION_ERROR` are the user's
problem, not the adapter's, and are excluded — otherwise a stream of malformed inputs would
disable a healthy adapter.

An open breaker surfaces as `degraded` on `/status` immediately. That is the visibility the
competitive analysis found missing in the category.

## 7. Writing an adapter

`src/server/resolver/adapters/example.ts`:

```ts
import { defineAdapter } from '../define'
import { extractFirstUrl } from '../../../lib/url/extract'

export const exampleAdapter = defineAdapter({
  id: 'example',
  name: 'Example Shortener',
  category: 'shortener',
  hosts: ['exmpl.co', 'go.exmpl.co'],
  priority: 10,
  listed: true,
  description: 'Expands exmpl.co short links via the documented redirect.',

  canHandle: (url) => /^\/[A-Za-z0-9]{5,12}$/.test(url.pathname),

  async resolve(url, ctx) {
    const res = await ctx.http.get(url, { redirect: 'manual', accept: 'text/html' })

    const location = res.headers.get('location')
    if (location) {
      return { kind: 'next', url: new URL(location, url).toString(),
               method: 'redirect', statusCode: res.status }
    }

    const found = extractFirstUrl(await res.text())
    if (!found) return { kind: 'skip', reason: 'no destination in response' }

    return { kind: 'next', url: found, method: 'html-extract', statusCode: res.status }
  },
})
```

Then one line in `src/server/resolver/registry.ts`. That is the whole extension surface.

`defineAdapter` is an identity function typed to give inference and to fail the build on a
missing field — no runtime cost, full editor support.

## 8. Testing an adapter

`ctx.http` is injected, so adapter tests need no network:

```ts
import { describe, expect, it } from 'vitest'
import { exampleAdapter } from './example'
import { makeTestContext, htmlResponse, redirectResponse } from '../testing'

describe('example adapter', () => {
  it('follows the Location header', async () => {
    const ctx = makeTestContext({
      responses: { 'https://exmpl.co/abc123': redirectResponse(301, 'https://dest.test/x') },
    })
    const out = await exampleAdapter.resolve(new URL('https://exmpl.co/abc123'), ctx)
    expect(out).toEqual({ kind: 'next', url: 'https://dest.test/x',
                          method: 'redirect', statusCode: 301 })
  })

  it('skips when the page has no destination', async () => {
    const ctx = makeTestContext({
      responses: { 'https://exmpl.co/abc123': htmlResponse('<html>nothing</html>') },
    })
    const out = await exampleAdapter.resolve(new URL('https://exmpl.co/abc123'), ctx)
    expect(out.kind).toBe('skip')
  })
})
```

Every shipped adapter has a matching test file. A new adapter without one fails CI.

## 9. Operational checklist for a new adapter

1. `canHandle` is narrow — it must not claim URLs it cannot resolve, or it starves the
   generic chain.
2. `id` matches the pattern `^[a-z0-9-]{2,32}$` and is never changed after release; historical
   rows and metric series key off it.
3. Timeouts are the context's, never a hand-rolled `setTimeout`.
4. No secrets in the adapter. Credentials come from env through `ctx`.
5. A test file exists covering the happy path and at least one failure path.
6. `/supported` copy is written from the user's side: what it does, not how it works.
