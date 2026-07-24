# ADR-0004 — Every external dependency optional with an in-process fallback

**Status:** Accepted · **Date:** 2026-07-24

## Context

The app uses Redis (cache, rate limits) and PostgreSQL (telemetry). Requiring both to be
present and healthy for the app to boot would make local development heavy, make CI slow and
flaky, and turn a dependency blip in production into a full outage.

## Decision

Every external dependency sits behind an interface with two drivers: a real one and an
in-process fallback. The app selects the real driver when its connection string is present and
reachable, and transparently falls back otherwise. With an empty environment the app boots and
serves correctly.

- Cache: Redis driver ↔ in-process LRU
- Rate limiter: Redis Lua sliding window ↔ in-process counter map
- Store: Postgres driver ↔ bounded in-memory ring buffer

## Rationale

- **Instant contributor loop.** `npm run dev` with no services starts and resolves. Nothing to
  install, nothing to orchestrate.
- **Fast, hermetic CI.** Unit and integration suites need no containers; the fallbacks are the
  same code paths a degraded production would use.
- **Graceful production degradation.** Redis down → softer limits and lower cache hit rate, not
  an outage. Postgres down → telemetry gaps, not failed resolves. Degradation is per-dependency
  and never global, matching the failure model in [02 §5](../02-architecture.md).
- **The fallbacks are permanently tested,** because they are the default in dev and CI. A
  fallback that only runs during an incident is a fallback you cannot trust; these run
  constantly.

## Consequences

- Two implementations per dependency to maintain, and a contract test asserting they behave
  identically. Accepted — the behaviour surface is small and the payoff is large.
- The in-memory drivers are per-process, so with multiple instances and no Redis, limits and
  cache are per-instance. This is documented as a known property ([09](../09-deployment-operations.md)),
  and the fix is simply to set `REDIS_URL`.
- Readiness (`/api/health?deep=1`) still reports a configured-but-unreachable dependency as
  unhealthy, so an operator is not blind to the fact that a fallback is engaged.

## Alternatives rejected

- **Hard-require both dependencies.** Simpler code, far worse operability and developer
  experience, and a single Redis blip becomes a customer-facing outage.
- **Fallback for cache only.** Half-measure; the store and limiter benefit from exactly the same
  reasoning, and consistency across the three keeps the pattern obvious.
