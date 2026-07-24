<div align="center">

# Clearway

**See where a link really goes.**

Paste a wrapped, shortened, or redirect link — get the destination back, with every hop it
took to get there. A production-grade link-gate resolver: a typed plugin engine with a
hardened egress path, public health telemetry, and a one-input UI.

</div>

---

## What it is

Clearway takes a URL that sits behind a shortener, a redirect chain, a wrapper parameter, a
base64 payload, or a paste host, and resolves it to its destination — showing the full route
as a numbered chain of hops. It is one deployable Next.js app that serves both the UI and a
versioned REST API, and it boots and serves correctly with **zero external dependencies**.

This is a clean-room reimplementation inspired by the link-bypasser category (see
[`docs/00-competitive-analysis.md`](docs/00-competitive-analysis.md)), built around three
rules the whole codebase obeys:

1. **Every outbound URL passes the SSRF guard.** No adapter calls `fetch` directly.
2. **Every inbound payload passes a Zod schema.** Handlers receive parsed, typed data only.
3. **Every dependency degrades.** No Redis and no PostgreSQL still boots and serves traffic.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:3000 — no database or cache required
```

Production build:

```bash
npm run build
npm start
```

Production-shaped local run with Postgres + Redis:

```bash
docker compose up --build
```

## What it resolves

| Family | Examples | How |
|---|---|---|
| Shorteners | bit.ly, TinyURL, is.gd, v.gd, rebrand.ly, cutt.ly | HTTP redirect following |
| Generic techniques | wrapper params, base64 payloads, meta-refresh, canonical, JS location | Standards-based extraction |
| Paste hosts | Pastebin, Rentry, Hastebin, dpaste, Paste.ee, ControlC | The host's own raw endpoint |

Ad-gates and social-unlock gates (Linkvertise, Work.ink, Rekonise, …) are listed as a
**documented extension point** but not resolved by default — see
[ADR-0005](docs/adr/0005-lawful-resolver-scope.md) for the reasoning.

## Architecture at a glance

```
Browser ─▶ Next.js (RSC pages + Route Handlers)
              ├── Resolver Engine ─▶ Adapter registry ─▶ Guarded HTTP client ─▶ Internet
              ├── Cache      (Redis → in-memory LRU)
              ├── Limiter    (Redis Lua → in-memory)
              └── Store      (PostgreSQL → in-memory ring buffer)
```

The engine models a resolution as a walk over a graph of URLs; each adapter contributes one
hop. Adding coverage is one file plus one registry line. Full detail in
[`docs/02-architecture.md`](docs/02-architecture.md) and
[`docs/06-resolver-engine.md`](docs/06-resolver-engine.md).

## API

```bash
curl -sS http://localhost:3000/api/v1/resolve \
  -H 'content-type: application/json' \
  -d '{"url":"bit.ly/3xAmPle"}' | jq
```

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/resolve` | Resolve a link; returns the destination and hop chain |
| `GET /api/v1/supported` | The service registry with live health |
| `GET /api/v1/status` | System and per-adapter health |
| `GET /api/health` | Liveness / readiness (`?deep=1`) |
| `GET /api/metrics` | Prometheus exposition |

Full contract: [`docs/04-api-specification.md`](docs/04-api-specification.md).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run check` | typecheck + lint + format check |
| `npm test` / `npm run test:cov` | Unit + integration (Vitest) |
| `npm run e2e` | End-to-end (Playwright) |
| `npm run migrate` | Apply SQL migrations (deploy step) |
| `npm run admin:hash` | Generate an `ADMIN_PASSWORD_HASH` |

## Configuration

Everything is environment variables, parsed through a Zod schema at boot — a bad value fails
the boot with a readable message. See [`.env.example`](.env.example) and
[`docs/09-deployment-operations.md`](docs/09-deployment-operations.md). Nothing is required
for local development.

## Security

An SSRF guard with a full private/reserved range table, DNS-rebinding defence (validated IP is
the connected IP), redirect re-validation, size/time/concurrency caps, sliding-window rate
limits, a strict per-request-nonce CSP, and no third-party scripts. The guard's test file is
the security spec as executable tests. Full model:
[`docs/07-security.md`](docs/07-security.md).

## Documentation

The [`docs/`](docs/) folder is the source of truth — PRD, architecture, tech stack, API spec,
data model, resolver engine, security, design system, deployment, testing, roadmap, and
decision records. Start at [`docs/README.md`](docs/README.md).

## License

[MIT](LICENSE). You are responsible for how you deploy and operate it, including any adapters
you add beyond what ships here.
