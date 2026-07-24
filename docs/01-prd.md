# 01 — Product Requirements Document

**Product:** Clearway
**Version:** 1.0
**Status:** Approved for build
**Owner:** Platform team

---

## 1. Problem

A link you were given does not go where it says it goes. It goes to an interstitial that wants
a dwell timer, three ad impressions, a subscription, or a captcha first. The destination is a
plain URL sitting one or more hops away, and the user has no way to see it.

Users in this position today either give up, install a browser extension of unknown
provenance, or paste the link into a utility site whose coverage is a mystery until it fails.

## 2. Product statement

> Clearway takes a wrapped URL and returns the destination, showing every hop it took to get
> there. Coverage is published, health is public, and the whole thing is one input field.

## 3. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Resolve a supported URL correctly | ≥ 97% success rate on the supported-adapter set |
| G2 | Feel instant | p50 ≤ 900 ms, p95 ≤ 4 s end-to-end |
| G3 | Make coverage legible | Every service has a public health state updated within 5 min of real traffic |
| G4 | Zero onboarding | First successful resolve in ≤ 2 interactions from a cold landing |
| G5 | Be safe to operate | Zero SSRF escapes; no unbounded resource consumption |
| G6 | Be extensible | A new adapter is one file plus one registry line, no core changes |

### Non-goals for v1

- User accounts, saved history synced across devices, or social features
- Proxying, mirroring, or rendering destination content
- Mobile apps
- Paid tiers or billing
- Adapters that defeat a provider's anti-bot or revenue enforcement (see ADR-0005)

## 4. Users

**Primary — "the blocked user."** Arrived from a forum, Discord, or a game-mod site with a
gated link. Wants the destination now. On mobile as often as desktop. Will not read
instructions. Judges the product entirely on whether the first paste works.

**Secondary — "the integrator."** Building a Discord bot, a userscript, or a scraper. Wants a
stable JSON API with documented errors and honest rate limits. Will read the docs.

**Tertiary — "the operator."** Runs the instance. Needs to know which adapters are failing,
how much traffic is hitting them, and how to disable one at 3am without a deploy.

## 5. User stories & acceptance criteria

### US-1 — Resolve a link (P0)

> As a blocked user, I paste a URL and get the destination.

- **AC1** The input accepts a URL with or without a scheme; `example.com/x` is normalised to
  `https://example.com/x`.
- **AC2** Submitting with an empty or non-URL value shows an inline validation message and
  does not issue a request.
- **AC3** On success the destination URL is displayed in full, is selectable, and has a
  one-click copy control that confirms it copied.
- **AC4** The full hop chain is displayed: every intermediate URL, its HTTP status, and the
  adapter that handled it, in order.
- **AC5** The destination is presented as an explicit outbound link with `rel="noopener
  noreferrer nofollow"`; it is never auto-navigated.
- **AC6** Resolution time is displayed in milliseconds.
- **AC7** Errors are typed and actionable — a stated reason plus what to do next — never a raw
  stack trace or a bare "something went wrong".
- **AC8** A copyable request ID accompanies every result and every error.

### US-2 — Paste from clipboard (P0)

> As a mobile user, I fill the field without fighting a text selection.

- **AC1** A paste control reads the clipboard and populates the input when the Clipboard API
  is available and permitted.
- **AC2** When unavailable or denied, the control is not rendered; the field still works.

### US-3 — See what is supported (P0)

> As a user deciding whether to bother, I check coverage first.

- **AC1** Services are grouped by category: ad-gates, social-unlock gates, shorteners, paste
  hosts, generic techniques.
- **AC2** Free-text search filters by service name and domain as the user types.
- **AC3** Each entry shows a health state: operational, degraded, or down.
- **AC4** Every service has its own indexable route with correct title, description, and
  canonical metadata.

### US-4 — See system health (P1)

> As a user whose link just failed, I want to know if it is me or them.

- **AC1** `/status` shows overall system state plus a per-adapter table: state, 24h success
  rate, p95 latency, sample count.
- **AC2** Metrics derive from real traffic, not synthetic checks.
- **AC3** The page is readable with zero data and says so plainly.

### US-5 — Use the API (P1)

> As an integrator, I resolve links from my own code.

- **AC1** `POST /api/v1/resolve` accepts `{ url }` and returns a documented JSON envelope.
- **AC2** Every error has a stable machine-readable `code`.
- **AC3** Rate-limit state is exposed on `X-RateLimit-*` headers; `429` includes `Retry-After`.
- **AC4** The contract is versioned in the path; v1 is additive-only after release.

### US-6 — Recent links on this device (P2)

> As a returning user, I get back to a link I resolved earlier.

- **AC1** The last 20 resolutions persist in `localStorage`, never on the server against an
  identity.
- **AC2** One control clears them, with no confirmation dialog needed.
- **AC3** The list renders only after hydration and never blocks first paint.

### US-7 — Operate the instance (P1)

> As the operator, I manage coverage without deploying.

- **AC1** A password-gated admin area lists adapters with live health and traffic counts.
- **AC2** An adapter can be disabled and re-enabled at runtime; the change takes effect on the
  next request and is reflected on `/supported` and `/status`.
- **AC3** The admin session is an httpOnly, signed, short-lived cookie.
- **AC4** Admin auth failures are rate-limited far more aggressively than public endpoints.

## 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Normalise and validate any submitted URL before use | P0 |
| FR-2 | Select adapters by host match, then by generic capability, in priority order | P0 |
| FR-3 | Follow redirect chains to a configurable maximum depth (default 10) | P0 |
| FR-4 | Extract destinations from `meta refresh`, `Location`, canonical wrapper params, and base64 payloads | P0 |
| FR-5 | Extract raw content and embedded URLs from paste hosts | P0 |
| FR-6 | Cache successful resolutions keyed by normalised URL, TTL configurable (default 1 h) | P0 |
| FR-7 | Rate-limit per client IP with a sliding window | P0 |
| FR-8 | Record every resolution attempt for health and analytics, with the URL stored as a salted hash | P1 |
| FR-9 | Open a circuit breaker on an adapter after a configurable consecutive-failure threshold | P1 |
| FR-10 | Serve `/api/health` (liveness/readiness) and `/api/metrics` (Prometheus text) | P1 |
| FR-11 | Generate `robots.txt` and `sitemap.xml` from the registry | P2 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP ≤ 1.8 s, INP ≤ 200 ms, CLS ≤ 0.1 on a mid-tier mobile over 4G. Home route JS ≤ 120 KB gzip |
| Availability | 99.5% monthly. Degradation is per-adapter, never global |
| Accessibility | WCAG 2.2 AA. Full keyboard operation, visible focus, live-region announcements for async results, `prefers-reduced-motion` honoured |
| Security | Every finding in [07 — Security](./07-security.md) mitigated before launch |
| Privacy | No accounts, no third-party analytics, no raw URL retention. IPs hashed with a rotating salt and never stored raw |
| Observability | Structured JSON logs with a request ID on every line; RED metrics per adapter |
| Portability | Runs on Node 20+ anywhere. No managed-service lock-in. Boots with zero external dependencies |
| i18n readiness | All user-facing copy in one module; no hardcoded strings in components |

## 8. Success metrics

| Metric | Target at 30 days |
|---|---|
| Resolve success rate (supported set) | ≥ 97% |
| p95 resolve latency | ≤ 4 s |
| Cache hit rate | ≥ 35% |
| Error rate 5xx | ≤ 0.5% |
| Bounce on `/` without a submit | ≤ 40% |
| Median time-to-first-result | ≤ 1.5 s from landing |

## 9. Release plan

- **M1 — Core** Resolver engine, generic adapters, API v1, home page, supported page. *Ship.*
- **M2 — Trust** Status page, health tracking, circuit breakers, admin dashboard.
- **M3 — Reach** Per-service landing routes, sitemap, userscript, OpenAPI document.
- **M4 — Scale** Redis-backed distributed limits and cache, worker queue for slow adapters.

Detail in [11 — Roadmap](./11-roadmap.md).

## 10. Open questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| Q1 | Funding model — ads, donations, or neither? | Operator | Deferred; no ad slots in v1, no third-party scripts to remove later |
| Q2 | Do we publish the userscript in-repo or on a script host? | Operator | M3 decision; the API contract is stable either way |
| Q3 | Retention window for resolution records | Operator | Default 30 days, configurable; documented in [05](./05-data-model.md) |
