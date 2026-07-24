# Clearway — Documentation

> Clearway is a link-gate resolver. Paste a gated, shortened, or wrapped URL and get the
> destination back, with the full hop chain shown as a route.

This folder is the single source of truth for what Clearway is, how it is built, and how it
is operated. Read it in order the first time; after that, jump straight to what you need.

| # | Document | What it answers |
|---|----------|-----------------|
| 00 | [Competitive analysis](./00-competitive-analysis.md) | What bypass.city does, how it behaves, what we keep and what we change |
| 01 | [Product requirements (PRD)](./01-prd.md) | Who this is for, what ships, what success looks like |
| 02 | [Architecture](./02-architecture.md) | How the system is put together and why |
| 03 | [Tech stack](./03-tech-stack.md) | Every dependency and the reason it is there |
| 04 | [API specification](./04-api-specification.md) | The public REST contract, v1 |
| 05 | [Data model](./05-data-model.md) | Tables, indexes, retention, migrations |
| 06 | [Resolver engine](./06-resolver-engine.md) | The plugin contract and how to write an adapter |
| 07 | [Security](./07-security.md) | Threat model, SSRF defence, headers, rate limits |
| 08 | [Design system](./08-design-system.md) | Tokens, type, motion, components |
| 09 | [Deployment & operations](./09-deployment-operations.md) | Environments, runbooks, observability |
| 10 | [Testing strategy](./10-testing-strategy.md) | What is tested, at what level, and the quality gates |
| 11 | [Roadmap](./11-roadmap.md) | Sequenced plan beyond v1 |
| 12 | [Decision records](./adr/) | Why the irreversible choices were made |

## Quick orientation

```
Browser ──▶ Next.js (RSC pages + Route Handlers)
                │
                ├── Resolver Engine ──▶ Adapter registry ──▶ Guarded HTTP client ──▶ Internet
                ├── Cache (Redis → memory fallback)
                └── Store (PostgreSQL → memory fallback)
```

Three rules the whole codebase obeys:

1. **Every outbound URL passes the SSRF guard.** No exceptions, no direct `fetch` in adapters.
2. **Every inbound payload passes a Zod schema.** Handlers receive parsed, typed data only.
3. **Every dependency degrades.** No Redis and no PostgreSQL still boots and serves traffic.

## Legal and scope position

Clearway ships resolvers for behaviour that is already public and standards-based: HTTP
redirect chains, `<meta http-equiv="refresh">`, `Location` headers, documented shortener
expansion APIs, URL wrapper parameters, and paste sites' own raw endpoints.

It does **not** ship code that defeats a specific provider's anti-bot, paywall, or ad-revenue
enforcement. The engine is a plugin host; an operator who has the standing to add such an
adapter can, and [06 — Resolver engine](./06-resolver-engine.md) documents the contract. That
choice, and its consequences, belong to the operator, not to this codebase.

See [ADR-0005](./adr/0005-lawful-resolver-scope.md) for the full reasoning.
