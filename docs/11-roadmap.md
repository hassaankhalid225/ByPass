# 11 — Roadmap

Sequenced by dependency and by risk. Each milestone is independently shippable.

## M1 — Core (this build)

The product a user can use, safely.

- [x] Resolver engine: registry, selection, budgets, loop detection
- [x] Generic adapters: redirect, meta-refresh, params, base64, js-location, canonical
- [x] Named shortener adapters and paste-host adapters
- [x] SSRF guard with the full range table and rebinding defence
- [x] Guarded HTTP client with size, time, and concurrency caps
- [x] API v1: `resolve`, `supported`, `status`, `health`, `metrics`
- [x] Rate limiting, sliding window, memory + Redis drivers
- [x] Cache, memory + Redis drivers
- [x] Store, memory + Postgres drivers, migrations
- [x] Frontend: home, supported, status, about, privacy, terms, faq, 404
- [x] Design system implemented; light/dark; a11y floor
- [x] Admin dashboard with runtime adapter toggles
- [x] Tests, Docker, CI, SEO metadata, sitemap, robots

**Exit criteria:** every PRD P0 met; security checklist green; quality gates passing.

## M2 — Trust & resilience

Make coverage observable and recovery automatic — the axis the competitive analysis found
weakest in the category.

- Circuit breaker surfaced end-to-end on `/status` with breaker-state history
- Health rollups promoted to a materialised view with scheduled refresh once volume warrants
- Admin: per-adapter traffic sparklines, failure samples (hashed), one-click cache purge
- Structured alerting wired to the metrics in [09 §7](./09-deployment-operations.md)
- Synthetic canary resolves for a known-stable set, so health is known even at zero organic
  traffic
- Status history / uptime timeline (last 90 days) on `/status`

## M3 — Reach & integration

Grow the surface that brings users in and lets others build on it.

- Per-service landing routes generated from the registry (`/service/[slug]`), each with tuned
  metadata — the real version of bypass.city's per-service SEO copy
- `sitemap.xml` and `robots.txt` generated from the registry
- Published **OpenAPI 3.1** document at `/api/v1/openapi.json`, plus a rendered reference page
- Userscript (Tampermonkey/Violentmonkey) that calls the public API to auto-resolve gated
  links in place — the automation path bypass.city offers, on top of our documented API
- Public, versioned API keys (optional) for higher integrator limits, still no account for the
  core web flow
- `og:image` generation per result-less share, and per service on landing pages

## M4 — Scale & advanced resolution

Handle the slow tail and higher volume without hurting the fast path.

- Job queue for slow adapters, so a multi-second resolve never occupies a request slot
- Isolated worker pool for any adapter that needs a real browser context, sandboxed and
  network-egress-restricted — kept entirely off the main request path
- Distributed cache warming for popular links
- Read-replica routing for analytics queries
- Multi-region deployment with a shared Redis and regional read replicas
- Per-adapter concurrency limits and priority classes

## M5 — Operator & community

Close the loop the category runs on — user-reported breakage to fast fixes.

- In-product "report a broken link" flow feeding an operator triage queue, keyed by the
  request ID so the exact chain is reproducible
- Community adapter contributions via the typed contract, gated by the test requirement and a
  review checklist ([06 §9](./06-resolver-engine.md))
- Coverage request board with vote counts, driving adapter prioritisation
- Public changelog generated from adapter additions and status events

## Explicitly out of scope (all milestones)

- Accounts and cross-device sync for the core resolve flow — friction that kills a utility
- Proxying, mirroring, or rendering destination content — a liability and a bandwidth sink we
  will not take on
- Any adapter that defeats a provider's anti-bot or revenue enforcement — see
  [ADR-0005](./adr/0005-lawful-resolver-scope.md). The extension point exists; the
  implementation is the operator's decision, not this project's default

## Sequencing rationale

M1 ships a safe, useful tool. M2 makes it *trustworthy*, which is the real differentiator and
therefore comes before reach. M3 grows the top of the funnel and the integrator surface only
once the thing they would rely on is observably healthy. M4 is deferred until real volume
proves it is needed — building the queue before there is a slow-adapter problem is speculative.
M5 institutionalises the feedback loop that keeps coverage alive, which matters most once there
is a community large enough to feed it.
