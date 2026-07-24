# ADR-0005 — Lawful resolver scope

**Status:** Accepted · **Date:** 2026-07-24

## Context

The category this product sits in ([00](../00-competitive-analysis.md)) mixes two technically
and legally distinct activities under one banner:

1. **Expanding and de-cloaking URLs** — following HTTP redirects, reading a `Location` header
   or a `<meta refresh>`, decoding a URL that a wrapper put in a query parameter or a base64
   payload, and fetching a paste host's own documented raw endpoint. These use public,
   standards-based mechanisms exactly as the standards intend.

2. **Defeating a provider's enforcement** — circumventing the anti-bot checks, mandatory
   dwell timers, ad impressions, or social-action gates that a specific company uses to
   monetise or protect its links. This targets a named party's technical and business measures.

These are not the same act, and conflating them in the codebase would be both a legal and an
engineering mistake.

## Decision

Clearway **ships** category 1: the generic techniques and the named shorteners and paste hosts
that resolve through public, documented mechanisms.

Clearway **does not ship** category 2. The engine registers gate categories (`ad-gate`,
`social-gate`) as declared-but-unimplemented adapters that surface publicly as `unavailable`.
The plugin contract, health tracking, breaker, admin toggle, and UI slot all exist, so an
operator with the standing to add such an adapter can do so by dropping a file into
`src/server/resolver/adapters/gates/` and adding a registry line — but that implementation, and
responsibility for it, is the operator's, not this project's default.

## Rationale

- **The two acts carry different legal exposure.** Following a redirect is not the same as
  circumventing a company's access-control and monetisation measures, which can implicate
  computer-misuse, contract, and copyright regimes that vary by jurisdiction. The codebase
  should not silently make that decision for whoever deploys it.
- **The engineering is cleaner.** Category 1 is deterministic, testable offline, and needs no
  browser, no captcha handling, and no evasion. Category 2 pulls in exactly those, along with
  the maintenance treadmill of an adversary that actively changes to stop you.
- **It is honest.** Presenting a gate as `unavailable` with a link to this reasoning is more
  truthful than shipping something that breaks weekly and pretends otherwise.
- **The extension point costs nothing to leave open** and keeps the architecture general, while
  the default stays defensible.

## Consequences

- Out of the box, Clearway resolves shorteners, wrapper params, redirect chains, and paste
  hosts, and is upfront that gated ad/social links are not handled by default.
- Coverage parity with a site that implements category 2 is not a goal of this repository, and
  the roadmap ([11](../11-roadmap.md)) lists that parity as explicitly out of scope.
- An operator who chooses to implement a gate adapter does so knowingly, with the full contract
  available, and owns the legal and operational consequences of that choice.

## Alternatives rejected

- **Ship everything the competitor does.** Takes on the maximum legal exposure and the maximum
  maintenance burden, and bakes a decision into the code that properly belongs to the deployer.
- **Ship nothing / drop the gate categories entirely.** Throws away a clean, general extension
  point and makes the architecture less honest about the category it serves.
