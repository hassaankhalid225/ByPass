# ADR-0002 — Plugin-based resolver engine

**Status:** Accepted · **Date:** 2026-07-24

## Context

Coverage in this category decays continuously — upstreams change markup and defences, adapters
break, new services appear. The core risk identified in [00](../00-competitive-analysis.md) is
not building one bypass, it is sustaining dozens as they rot. The engine's structure has to
make adding, testing, disabling, and observing an adapter cheap and safe.

## Decision

Model resolution as a walk over a graph of URLs, where each adapter is a plugin implementing a
single typed contract (`ResolverAdapter`) and contributes exactly one hop per call. A registry
selects adapters by host, then by generic capability. See [06](../06-resolver-engine.md).

## Rationale

- **Adding coverage is one file + one line.** No core change, so the blast radius of a new
  adapter is itself.
- **One hop per call** gives the engine — not the adapter — ownership of budgets, loop
  detection, and the explainable chain. Adapters cannot subvert those.
- **`ctx.http` injection** means every adapter is unit-testable offline and every adapter is
  forced through the SSRF guard. Security and testability fall out of the same decision.
- **Per-adapter health and a breaker** are possible only because adapters are discrete,
  identified units. This is what makes coverage *observable*, the product's main differentiator.
- **Generic adapters as first-class plugins** cover the long tail without naming every service,
  matching the finding that much of the category's "support" is really generic technique.

## Consequences

- A small amount of engine ceremony (the context, the result union) that a pile of ad-hoc
  scripts would not have. Paid back the first time an adapter needs disabling at 3am without a
  deploy.
- The contract is a public surface for the codebase; changing it is a breaking change for every
  adapter, so it is designed conservatively and versioned in spirit.

## Alternatives rejected

- **A switch over service names with inline logic.** Fast to start, impossible to test in
  isolation, no per-service health, no clean disable. Exactly the fragile shape the category
  suffers from.
- **A rules engine / config-driven resolver.** Too rigid for the variety of extraction
  techniques; the moment a service needs real logic the config becomes a programming language.
