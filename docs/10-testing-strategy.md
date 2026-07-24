# 10 — Testing strategy

## 1. Shape

A wide unit base, a focused integration layer, and a thin end-to-end cap. The engine is pure
and injected, so most confidence is bought cheaply at the unit level.

```
        e2e (Playwright) ── the few flows a user actually performs
      integration (Vitest) ── API handlers over the real engine with a fake network
   unit (Vitest) ─────────── SSRF guard, adapters, engine, URL utils, limiter, cache
```

## 2. What is tested where

### Unit — the majority of assertions

| Target | Focus |
|---|---|
| **SSRF guard** | Every rejected range in [07 §2.3](./07-security.md), plus the bypass corpus: decimal/octal/hex IPs, IPv4-mapped IPv6, short-form `127.1`, trailing-dot hosts, bracketed `[::1]`, credentialed hosts, `@`-confusion URLs, non-http schemes. This file is the security spec as executable tests |
| **Each adapter** | Happy path and ≥ 1 failure path, with an injected fake `ctx.http`. Redirect following, meta-refresh parsing, param extraction, base64 decoding, paste raw mapping, relative-URL resolution |
| **Engine** | Multi-hop chains, terminal detection, loop detection, max-hops, budget exhaustion → partial, adapter selection order (host beats generic, priority within tier), breaker open/half-open/closed transitions |
| **URL utilities** | Normalisation (scheme, case, tracking-param strip, punycode), first-URL extraction, wrapper-param detection |
| **Rate limiter** | Sliding-window correctness, window rollover, the memory driver matching the Redis driver's behaviour |
| **Cache** | TTL expiry, success/failure TTL split, memory-driver LRU eviction |
| **Env parsing** | Missing required var fails; malformed values rejected with a readable message |

### Integration — handlers over the real engine

Route handlers exercised with the genuine engine and registry, but the *network* is faked at
the guarded HTTP client. This proves validation, envelope shape, status codes, error mapping,
rate-limit headers, and cache behaviour end-to-end within the process, with no external
dependency and no real egress.

| Case | Asserts |
|---|---|
| Valid resolve | `200`, envelope shape, chain present and ordered, `X-RateLimit-*` set |
| Schemeless input | Normalised and resolved |
| Invalid URL | `400 INVALID_URL` |
| Private-IP target | `403 BLOCKED_URL` |
| Unknown host, no generic match | `422 UNSUPPORTED_URL` |
| Over the limit | `429 RATE_LIMITED` + `Retry-After` |
| Oversized body | `413` |
| Wrong content type | `415` |
| Cache hit | Second identical call returns `cached: true` and is faster |
| Admin without session | `401`; admin unconfigured → `404` |

### End-to-end — real browser, real server

Playwright against a built app (memory drivers, network stubbed at a controlled test upstream),
across Chromium, Firefox, WebKit, and a mobile viewport.

| Journey | Asserts |
|---|---|
| Resolve a link | Type, submit, see the route strip animate, see the destination sign, copy confirms |
| Validation | Empty submit shows an inline message, issues no request |
| Error surface | A blocked URL shows a typed, readable error with a request ID |
| Supported page | Search filters live; category tabs work by keyboard; health badges render |
| Status page | Renders with data and with zero data |
| Theme | Toggle persists across reload with no flash |
| Local history | A resolve appears in recent; clear empties it; survives reload |
| Mobile | Route strip renders as a vertical timeline; tap targets ≥ 44 px |

## 3. Accessibility testing

Automated axe-core assertions run inside the Playwright suite on `/`, `/supported`, `/status`,
and an error state — zero serious or critical violations is a merge gate. Beyond the automated
pass, the manual checklist from [08 §7](./08-design-system.md) is verified per release:
keyboard-only completion of a resolve, screen-reader announcement of the async result, 200%
zoom without horizontal scroll, and `prefers-reduced-motion` honoured.

## 4. Quality gates (CI, blocking)

| Gate | Command | Threshold |
|---|---|---|
| Types | `tsc --noEmit` | Zero errors |
| Lint | `eslint .` | Zero errors, including the layer-boundary rule |
| Format | `prettier --check` | Clean |
| Unit + integration | `vitest run --coverage` | See §5 |
| Build | `next build` | Succeeds |
| E2E | `playwright test` | All pass |
| Accessibility | axe in e2e | Zero serious/critical |
| Dependencies | `npm audit --omit=dev --audit-level=high` | Clean |

Every gate blocks merge. No override path in the branch protection.

## 5. Coverage policy

Coverage is targeted where a defect is expensive, not chased as a global percentage.

| Area | Line coverage floor |
|---|---|
| `src/lib/net` (SSRF) | 100% — no untested branch in the security boundary |
| `src/server/resolver` (engine + adapters) | ≥ 90% |
| `src/lib/url`, limiter, cache | ≥ 90% |
| API handlers | ≥ 85% |
| Overall | ≥ 80% |

A high number on the UI layer is not a goal; the e2e suite covers what matters there, and
chasing coverage on presentational components produces brittle tests, not confidence.

## 6. Test data and fixtures

- **Fake HTTP client.** `makeTestContext({ responses })` maps URLs to canned responses
  (redirect, HTML, JSON, timeout, oversized). Adapters and the engine test against it, so the
  suite is fully offline, deterministic, and fast.
- **No time flakiness.** The clock is injected where behaviour depends on it (limiter windows,
  breaker cooldowns, cache TTLs), so time-based tests are deterministic and do not sleep.
- **Deterministic IDs.** The request-ID generator is seedable in tests.

## 7. What is deliberately not tested

- Third-party upstream behaviour. We test our handling of *shapes* of response, not real
  external services — those change and would make the suite flaky and slow.
- Next.js framework internals.
- Visual pixel snapshots. The design tokens are asserted structurally; pixel diffing is high-
  maintenance and low-signal for this UI.

## 8. Local commands

```bash
npm test               # unit + integration, watch off
npm run test:watch     # TDD loop
npm run test:cov       # coverage report
npm run e2e            # Playwright, all projects
npm run e2e:ui         # Playwright interactive
npm run check          # typecheck + lint + format:check — the pre-push gate
```
