# ADR-0003 — Raw parameterised SQL instead of an ORM

**Status:** Accepted · **Date:** 2026-07-24

## Context

Persistence is small and analytical: two tables, one view, and fewer than ten queries, most of
them aggregates for the health and status surfaces. The store is deliberately off the critical
path of a resolve ([02](../02-architecture.md)).

## Decision

Use `pg` (node-postgres) with hand-written, parameterised SQL behind a `Store` interface.
Migrations are numbered `.sql` files applied by a small idempotent runner.

## Rationale

- **The surface is tiny.** Eight `$1`-parameterised statements do not justify a query engine,
  a codegen step, or a client the size of the rest of the runtime dependencies combined.
- **No build-time codegen.** An ORM's `generate` step lands in every CI run and every Docker
  layer. Raw SQL has no such step; the build is simpler and faster.
- **Auditability.** The exact query that runs is in the source. For a security-sensitive
  service, "what SQL executes" being directly readable is a feature.
- **The interesting queries are SQL anyway.** `percentile_disc(... ) WITHIN GROUP` and
  `FILTER (WHERE ...)` aggregates are clearer as SQL than as an ORM's aggregate DSL, which
  would need raw escape hatches for exactly these.
- **The `Store` interface preserves swap-ability.** The Postgres and in-memory drivers implement
  the same interface, so the choice does not leak into the domain layer.

## Consequences

- SQL injection is prevented by discipline (parameterisation) plus a lint rule banning template
  literals in `query()`, rather than by an ORM's API shape. The [testing](../10-testing-strategy.md)
  and [security](../07-security.md) docs treat this as a first-class concern.
- No automatic migration generation; migrations are written by hand. For two tables this is a
  feature — each migration is a reviewable, intentional diff.
- If the schema grew to dozens of related tables with complex relationships, this decision
  would be worth revisiting. It is scoped to the actual v1 shape.

## Alternatives rejected

- **Prisma.** Codegen in every build, a large client, a query-engine binary, cold-start cost —
  all to avoid writing eight statements. Wrong trade at this size.
- **Drizzle.** Lighter than Prisma and a reasonable choice, but still a schema DSL and a query
  builder for a surface that does not need one. The raw driver is less to learn and less to
  ship.
- **An in-memory-only store.** Would lose cross-restart health history and block horizontal
  scale of analytics. The memory driver exists as a *fallback*, not the primary.
