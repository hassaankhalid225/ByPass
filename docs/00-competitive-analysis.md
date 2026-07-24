# 00 — Competitive analysis: bypass.city

Field notes from analysing <https://bypass.city> and its ecosystem, and the conclusions we
carried into Clearway's design.

## 1. What the product is

A single-purpose web utility. The user has a URL that sits behind an ad-gate, a social-unlock
gate, a shortener, or a paste wrapper. They paste it into one input, press one button, and get
the destination URL back. No account, no quota, no email.

The tagline on the homepage is a direct competitive claim — that it bypasses links other
bypassers cannot — which tells you the category is commoditised and the only defensible axis
is **coverage** and **freshness of coverage**.

## 2. Surface map

| Surface | Purpose | Observed detail |
|---|---|---|
| `/` | The tool | One input, paste-from-clipboard affordance, primary CTA. Homepage headline is service-specific ("Bypass Work.ink") — evidence of rotating/targeted landing copy for SEO |
| `/supported` | Coverage proof | ~55+ named services in a flat list, with a "custom backend" claim and a `Start bypassing now!` CTA back to `/` |
| `/about` | Positioning | "Free platform", "no account required", "clean design, regular updates" |
| `/privacy`, `/terms` | Compliance | Standard static legal pages |
| FAQ (on `/`) | Objection handling | "Does it work?", "Are there restrictions?", "What if I get an error?" |
| Userscript | Automation | Tampermonkey script that auto-redirects gated links without visiting the site |
| Discord | Support + coverage reports | Where breakage is reported and fixes are announced |
| Donate (crypto) | Funding | Explicit promise: ads disappear once the monthly funding goal is met |
| Trustpilot | Social proof | External trust signal, unusual for this category |

A session ID and a date are rendered in the footer — an operational fingerprint used for
support triage ("give us your session ID").

## 3. Supported-service taxonomy

The flat list is really four distinct technical families, and conflating them is a UX mistake
we do not repeat:

| Family | Examples observed | Technical shape |
|---|---|---|
| **Ad-gates** | Linkvertise, Work.ink, Lootlinks, AdFoc.us, Ad-Maven, shorte.st, boost.ink, mboost.me, LetsBoost, BoostFusedGT | Interstitial with enforced dwell time and ad impressions |
| **Social-unlock gates** | Sub2Get, Sub2Unlock (.com/.net), Rekonise, SubFinal, sub1s, Social Unlocks, socialwolvez | Requires a social action (follow/subscribe) before release |
| **Plain shorteners** | bit.ly, tinyurl.com, is.gd, v.gd, rebrand.ly, tinylink.onl | Pure HTTP 30x redirect, no gate |
| **Paste / content hosts** | Pastebin, Rentry, JustPaste.it, PrivateBin, ControlC, Hastebin, Pastelink, +20 more | Content extraction, not redirection |
| **Meta-resolvers** | BaseResolver, ParamsResolver, "Location Redirect", "google-url" | Generic techniques (base64 payloads, query params, `Location` header, Google redirect wrapper) exposed as pseudo-services |

That last row is the most interesting finding: a large share of "supported sites" are not
site-specific at all — they are **generic techniques**. A well-built generic layer covers a
long tail for free. Clearway makes that layer first-class instead of hiding it behind
service names.

## 4. What works well (kept)

- **One input, one action.** No configuration, no mode selector, zero onboarding.
- **Coverage as the marketing page.** `/supported` is the conversion page, not `/about`.
- **No account, no quota.** Friction here kills a utility.
- **A support channel wired to breakage.** Coverage rots continuously; the feedback loop is
  the product.
- **Honest funding statement.** Naming the cost and the condition for removing ads reads as
  credible rather than grasping.

## 5. What is weak (changed)

| Weakness observed | Clearway's answer |
|---|---|
| Flat, unsearchable, unfiltered list of 55+ services | Categorised, searchable, filterable grid with live per-service health |
| No status indicator — a broken service looks identical to a working one | Public `/status` page with per-adapter health, success rate, and p95 latency, computed from real traffic |
| The result is a single opaque URL; no explanation of what happened | The hop chain is the result. Every redirect is shown as a numbered step with its status code |
| No public API | Documented, versioned, rate-limited REST API v1 |
| Manual, ad-hoc coverage additions | A registry with a typed adapter contract, health tracking, and a kill switch per adapter |
| Unbounded free resolution with no abuse controls | Sliding-window rate limits, request caps, and per-adapter circuit breakers |
| Session ID shown but not explained | A copyable request ID on every result and error, referenced in the support flow |
| SEO-targeted landing copy per service, but a single generic page | Real per-service landing routes generated from the registry, each with correct metadata |

## 6. Category risks we design around

1. **Coverage decay.** Gate providers change markup and defences constantly. Any adapter will
   break. The architecture therefore assumes breakage: health tracking, circuit breakers,
   graceful per-adapter failure, and a generic fallback chain that still returns *something*.
2. **Abuse as an SSRF proxy.** A service that fetches arbitrary user-supplied URLs is an
   open-proxy and internal-network-scanner unless it is hardened. This is the single largest
   technical risk in the category and gets a dedicated defence layer. See
   [07 — Security](./07-security.md).
3. **Legal exposure.** Defeating a provider's revenue enforcement is a different act from
   expanding a `bit.ly` link. Clearway separates the two explicitly rather than blurring them.
   See [ADR-0005](./adr/0005-lawful-resolver-scope.md).
4. **Content liability.** Resolved destinations are arbitrary third-party URLs. We do not
   proxy, mirror, or render destination content; we return the URL and let the browser decide.

## 7. Conclusion carried into the PRD

The winning product in this category is not the one with the cleverest single bypass. It is
the one whose **coverage is observable, whose breakage is visible, and whose recovery is
fast**. Clearway is therefore built as a resolver *platform* — a typed plugin host with
health telemetry — rather than a bag of scripts behind a text box.
