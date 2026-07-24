# ADR-0001 — Next.js App Router as a single deployable

**Status:** Accepted · **Date:** 2026-07-24

## Context

Clearway needs server-rendered marketing/coverage pages that index well, a JSON API, and one
small interactive surface (the resolve form). The options were a split frontend + backend, or
a single full-stack framework.

## Decision

One Next.js 15 App Router application serving both the RSC pages and the API route handlers,
deployed as a single `output: 'standalone'` artifact on the Node runtime.

## Rationale

- **One deployable, one build, one image.** No CORS, no shared-types package, no version skew
  between a separate client and server.
- **RSC keeps the client tiny.** Everything except the form is server-rendered; the home route
  ships a single client island.
- **`generateStaticParams`** turns the service registry into indexable per-service pages for
  free — the SEO surface the competitor hand-maintains.
- **Route-level caching** (`revalidate`) fits the data perfectly: the registry changes on the
  order of days, status on the order of seconds.
- **Node runtime, not Edge**, because the SSRF guard needs raw `dns.lookup` and direct-to-IP
  connections that the Edge runtime does not offer.

## Consequences

- Tied to Next's App Router conventions and its release cadence.
- The API lives inside a UI framework, so the layer boundaries in [02](../02-architecture.md)
  are enforced by lint rather than by a process boundary. Accepted, and cheaper than running
  two services.
- Horizontal scale is trivial — the app is stateless once Redis is configured.

## Alternatives rejected

- **Vite SPA + Fastify API.** Two deployables, hand-rolled SSR for SEO, manual cache layer.
  More moving parts for no gain at this size.
- **Remix.** Capable, but weaker static generation for the per-service SEO pages.
- **Astro + separate API.** Great for the content pages, wrong shape for a JSON API and an
  interactive island of this kind.
