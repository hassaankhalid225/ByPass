# 03 — Tech stack

Every dependency below earns its place. The rule applied throughout: prefer the platform,
prefer one dependency over three, and never take a dependency that cannot be removed without
a rewrite.

## 1. Runtime

| Choice | Version | Why |
|---|---|---|
| Node.js | ≥ 20.11 LTS | Native `fetch`, `AbortSignal.timeout`, `node:dns/promises`, stable ESM. Node runtime (not Edge) is required because the SSRF guard needs raw DNS resolution |
| TypeScript | 5.7 | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Types are the primary design tool here, especially for the adapter contract |

## 2. Application framework

| Choice | Why | Alternative rejected |
|---|---|---|
| **Next.js 15 (App Router)** | One deployable serving RSC pages and API route handlers. Streaming, per-route caching, and file-system routing remove an entire class of glue code. `generateStaticParams` gives free per-service landing pages from the registry | Vite + Fastify: two deployables, hand-rolled SSR, no route-level caching. Remix: fine, but weaker static generation for the SEO surface |
| **React 19** | Server Components keep the home route to a single client island. `useActionState`/`useTransition` model the pending state of a resolve without a state library | — |

## 3. Styling and UI

| Choice | Why | Alternative rejected |
|---|---|---|
| **Tailwind CSS v4** | CSS-first config via `@theme`, so design tokens live in one CSS file and are consumable by both Tailwind utilities and raw CSS. No JS config file, no runtime | CSS Modules: token sharing gets manual. CSS-in-JS: runtime cost, RSC friction |
| **Hand-built primitives** | Button, Input, Card, Badge, Tabs are ~200 lines total. A component library would be more code than it saves and would dictate the visual language | shadcn/ui, MUI: the design direction here is specific enough that generic components fight it |
| **lucide-react** | Consistent, tree-shakeable icon set. Only imported icons ship | Icon fonts: layout shift, a11y problems |
| **Google Fonts via `next/font`** | Self-hosted at build time, zero layout shift, no third-party request at runtime | CDN link tags: extra RTT, CSP hole, privacy leak |

Typefaces: **Archivo** (display), **Public Sans** (body), **IBM Plex Mono** (URLs and data).
Rationale in [08 — Design system](./08-design-system.md).

## 4. Validation and types

| Choice | Why |
|---|---|
| **Zod 3** | One schema yields runtime validation and the static type. Used at every boundary: request bodies, query params, env vars, adapter outputs |

`src/lib/env.ts` parses `process.env` through a Zod schema at import time. A misconfigured
deployment fails at boot with a readable message rather than at 3am with a `undefined is not a
function`.

## 5. Data

| Choice | Why | Alternative rejected |
|---|---|---|
| **PostgreSQL 16** | The analytics and health queries are relational aggregate queries. `jsonb` covers the hop chain without a second store | MongoDB: no benefit here. SQLite: fine for one node, blocks horizontal scale |
| **`pg` (node-postgres) + raw SQL** | Two tables and eight queries do not need an ORM. Raw parameterised SQL is auditable, has no codegen step, no schema-drift class of bug, and no cold-start penalty | Prisma: a `generate` step in every build and container layer, a large client, and a query engine binary — all to save writing eight `$1`-parameterised statements. See [ADR-0003](./adr/0003-raw-sql-over-orm.md) |
| **Numbered SQL migrations** | `migrations/0001_init.sql` applied by an idempotent runner with an advisory lock. Reviewable in a PR diff | Auto-migrate on boot: unsafe under concurrency |

## 6. Cache, limits, and coordination

| Choice | Why |
|---|---|
| **Redis 7 via `ioredis`** *(optional)* | Shared cache and shared sliding-window rate limits across instances. `ioredis` because it has first-class Lua `defineCommand`, which the atomic sliding-window limiter needs |
| **In-process fallback** | An LRU cache and a counter map behind the same interfaces. `REDIS_URL` unset means the app still boots and still rate-limits — just per-process |

## 7. Security

| Choice | Why |
|---|---|
| **`jose`** | Admin session JWTs. Web Crypto based, works in any runtime, no `jsonwebtoken` CVE history |
| **`node:crypto` `scrypt`** | Admin password verification with `timingSafeEqual`. No password hashing dependency needed |
| **Hand-written SSRF guard** | `src/lib/net/ssrf.ts`. There is no dependency worth trusting for this, and the logic must be reviewable line by line. Covers scheme allowlist, DNS resolution, IPv4/IPv6 private and reserved ranges, redirect re-validation, and DNS-rebinding defence |
| **Middleware-set headers** | CSP with a per-request nonce, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. No `helmet` needed — Next.js middleware sets them directly |

## 8. Observability

| Choice | Why |
|---|---|
| **`pino`** | Fast structured JSON logging. Every line carries `requestId`. `pino-pretty` in dev only |
| **Hand-rolled Prometheus exposition** | The metric set is eight series. A client library is more surface than value; `/api/metrics` renders text format directly |

## 9. Testing

| Choice | Why |
|---|---|
| **Vitest 2** | Unit and integration. Same esbuild pipeline as the app, native TS/ESM, no Babel |
| **Playwright** | End-to-end across Chromium, Firefox, WebKit, plus a mobile viewport. Also drives the accessibility assertions |
| **`msw`-free approach** | The guarded HTTP client is injected, so adapter tests pass a fake fetch. No network-interception layer needed |

## 10. Tooling

| Choice | Why |
|---|---|
| **ESLint 9 flat config + `eslint-config-next`** | Plus a `no-restricted-imports` rule enforcing the layer boundaries from [02](./02-architecture.md) |
| **Prettier** | One formatting argument, settled |
| **Docker multi-stage + `output: 'standalone'`** | ~180 MB final image, non-root user, no dev dependencies, no source |
| **GitHub Actions** | typecheck → lint → unit → build → e2e → `npm audit` → image build. Every gate blocks merge |

## 11. Dependency inventory

**Runtime (10)**

```
next  react  react-dom  zod  pg  ioredis  jose  pino  lucide-react  clsx
```

**Development (12)**

```
typescript  @types/node  @types/react  @types/react-dom  @types/pg
tailwindcss  @tailwindcss/postcss  eslint  eslint-config-next
vitest  @playwright/test  pino-pretty  prettier
```

Ten runtime dependencies. Every one is on the critical path or optional-with-fallback; there
is no convenience dependency in the tree.

## 12. What was deliberately not used

| Not used | Why |
|---|---|
| A state manager (Redux/Zustand/Jotai) | The app has one piece of async state. `useActionState` covers it |
| A data-fetching library (React Query/SWR) | Server Components fetch on the server; the one client mutation is a plain `fetch` |
| An ORM | See ADR-0003 |
| A component library | See §3 |
| A headless browser (Puppeteer/Playwright at runtime) | 300+ MB, a sandbox escape surface, and 3–8 s per resolve. The generic adapters do not need a DOM. If an adapter ever does, it belongs behind the M4 queue on an isolated worker, not in the request path |
| Third-party analytics | Privacy commitment in the PRD, and a CSP hole we would have to open |
| An auth provider | One admin login. A signed cookie is the correct size of solution |
