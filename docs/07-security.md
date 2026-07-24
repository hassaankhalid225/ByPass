# 07 — Security

A service whose entire purpose is to fetch a URL a stranger gave it is, by default, an open
proxy and an internal network scanner. This document is not a formality.

## 1. Threat model

**Assets:** the internal network the app runs in, cloud instance metadata, the database,
admin credentials, and the availability of the service itself.

**Actors:** anonymous internet users (the whole user base is untrusted), automated abuse at
scale, and a malicious upstream that controls a page we fetch.

| # | Threat | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| T1 | **SSRF** — target a private IP, `localhost`, or cloud metadata | Critical | Certain, it will be tried within hours | §2 |
| T2 | **DNS rebinding** — pass validation, then re-resolve to a private IP | Critical | Low, but trivially automatable | §2.4 |
| T3 | **Redirect-based SSRF** — public URL redirects to `127.0.0.1` | Critical | High | §2.5 |
| T4 | **Resource exhaustion** — huge bodies, slow-loris upstreams, deep chains | High | High | §3 |
| T5 | **Open-proxy abuse** — use us to launder traffic at another host | High | High | §3, §4 |
| T6 | **XSS via destination URL** rendered in the UI | High | Medium | §5 |
| T7 | **SQL injection** | Critical | Low | §6 |
| T8 | **Admin takeover** | Critical | Medium | §7 |
| T9 | **Privacy leak** — resolved URLs are sensitive by nature | High | Medium | §8 |
| T10 | **Supply chain** — a compromised dependency exfiltrating URLs | High | Low | §9 |
| T11 | **Header injection / response splitting** via upstream `Location` | Medium | Low | §2.5 |
| T12 | **Zip-bomb / decompression bomb** response | Medium | Low | §3 |

## 2. SSRF defence — `src/lib/net/ssrf.ts`

The single most important file in the repository. Defence in depth, five layers, all of them
mandatory and none of them bypassable from an adapter.

### 2.1 Scheme allowlist

Only `http:` and `https:`. Everything else — `file:`, `gopher:`, `ftp:`, `data:`, `blob:`,
`jar:`, `dict:`, `ldap:` — is rejected before anything else runs. Allowlist, never denylist.

### 2.2 Host shape validation

Rejected outright: empty hosts, hosts with credentials (`user:pass@`), non-standard ports
(only 80, 443, and `EXTRA_ALLOWED_PORTS` are permitted), `.local`/`.internal`/`.localhost`
and other special-use TLDs, single-label hosts with no dot, and any host that is not valid IDNA.
Unicode hosts are converted to punycode *before* validation so homograph forms cannot slip
past a string comparison.

### 2.3 DNS resolution and IP range checks

The hostname is resolved with `dns.promises.lookup(host, { all: true })` and **every returned
address** is checked. One bad address rejects the request — a host with both a public and a
private A record is a rebinding attack, not a misconfiguration.

Rejected IPv4 ranges:

```
0.0.0.0/8         current network       10.0.0.0/8        private
100.64.0.0/10     CGNAT                 127.0.0.0/8       loopback
169.254.0.0/16    link-local + AWS/GCP/Azure metadata (169.254.169.254)
172.16.0.0/12     private               192.0.0.0/24      IETF protocol
192.0.2.0/24      TEST-NET-1            192.88.99.0/24    6to4 relay
192.168.0.0/16    private               198.18.0.0/15     benchmarking
198.51.100.0/24   TEST-NET-2            203.0.113.0/24    TEST-NET-3
224.0.0.0/4       multicast             240.0.0.0/4       reserved
255.255.255.255/32 broadcast
```

Rejected IPv6 ranges:

```
::/128 unspecified      ::1/128 loopback        ::ffff:0:0/96 IPv4-mapped (unwrapped, then re-checked)
64:ff9b::/96 NAT64      100::/64 discard        2001:db8::/32 documentation
fc00::/7 unique-local   fe80::/10 link-local    ff00::/8 multicast
fec0::/10 site-local (deprecated but still routed by some stacks)
```

IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) are unwrapped and re-checked against the IPv4
table — a classic bypass that string matching misses.

### 2.4 DNS rebinding — pinned connections

Validating a hostname then handing it to `fetch` leaves a TOCTOU window: the attacker's DNS
server returns a public IP for our check and `127.0.0.1` for the actual connection.

The guarded client closes it by **connecting to the validated IP directly**: it builds the
request against the literal address, sets the `Host` header to the original hostname, and for
HTTPS sets `servername` for SNI and certificate validation. The name resolved during
validation is the name connected to, atomically. No second lookup happens.

### 2.5 Redirects re-enter the guard

`redirect: 'manual'` everywhere. No `Location` is ever followed by the HTTP stack. Each hop is
returned to the engine, re-validated from scratch through §2.1–§2.4, and only then fetched.

`Location` values are parsed with the `URL` constructor and re-serialised before use, which
also neutralises CR/LF header-injection attempts (T11).

### 2.6 Test coverage

`src/lib/net/ssrf.test.ts` asserts rejection for every range above plus the known bypass
corpus: decimal IPs (`2130706433`), octal (`0177.0.0.1`), hex (`0x7f.0.0.1`), short form
(`127.1`), IPv4-mapped IPv6, trailing-dot hosts (`localhost.`), `[::1]` bracket form,
credential-embedded hosts, and `http://spoofed.example.com@127.0.0.1/`. **A change to the
guard that does not update these tests fails CI.**

## 3. Resource limits

| Limit | Value | Enforcement |
|---|---|---|
| Request body | 8 KB | Rejected at the handler before parsing |
| Response body | 2 MB | Counted while streaming; the stream is cancelled on breach — never `await res.text()` on an unbounded body |
| Total resolve time | 15 s | `AbortSignal.timeout`, threaded everywhere |
| Per-hop time | 6 s | Composed signal per hop |
| Chain depth | 10 hops | Engine counter |
| Concurrent outbound per instance | 32 | Semaphore in the HTTP client |
| Decompression | `Accept-Encoding: identity` on HTML fetches | Removes the decompression-bomb class entirely (T12); the small bandwidth cost is worth it |

## 4. Rate limiting

Sliding window, keyed on a salted hash of the client IP, executed as an atomic Redis Lua
script (or an in-process equivalent) so concurrent requests cannot race past the limit.

| Endpoint | Limit |
|---|---|
| `POST /api/v1/resolve` | 30 / 60 s |
| `GET /api/v1/supported` | 120 / 60 s |
| `GET /api/v1/status` | 60 / 60 s |
| `POST /api/v1/admin/session` | **5 / 15 min** |
| Other admin endpoints | 60 / 60 s |
| `GET /api/health` | exempt |

Client IP comes from `TRUSTED_PROXY_COUNT` hops back in `X-Forwarded-For`, never the leftmost
value. Trusting the leftmost entry means every attacker sets their own rate-limit bucket.

Responses always carry `X-RateLimit-*`; a `429` carries `Retry-After`. Being honest about
limits is cheaper than being scraped by clients that cannot tell they are being throttled.

## 5. Frontend and headers

Every response gets these, set in `src/middleware.ts`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';
  connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self';
  frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

There are no third-party scripts, fonts, or analytics, so `default-src 'self'` holds with no
exceptions. `style-src 'unsafe-inline'` is the one concession — Next.js emits inline critical
CSS — and it is not an XSS vector on its own given `script-src` is nonce-gated.

**Destination URL rendering (T6).** The destination is untrusted user-influenced data:

- rendered as text via React's escaping, never `dangerouslySetInnerHTML`;
- the anchor's `href` is re-validated as `http:`/`https:` at render time, so a `javascript:`
  destination renders as inert text with a warning instead of a link;
- `rel="noopener noreferrer nofollow"` and `target="_blank"`;
- never auto-navigated — the user always clicks;
- displayed with the host segment emphasised, so a lookalike domain is visible rather than
  buried in a long path.

## 6. Injection

Every statement is parameterised through `pg`'s `$1` placeholders. There is no string
concatenation anywhere in `src/server/store`, and a lint rule bans template literals in
`query()` calls. Identifiers are never dynamic. No stored procedures, no dynamic SQL.

## 7. Admin authentication

- Password supplied as `ADMIN_PASSWORD_HASH` — a `scrypt` digest, never a plaintext password
  in the environment. `npm run admin:hash` generates it.
- Verification uses `timingSafeEqual` on fixed-length buffers.
- On success: a `jose`-signed JWT (HS256, `ADMIN_SESSION_SECRET` ≥ 32 bytes) with `iss`,
  `aud`, `exp` (2 h), and `jti`, set as `HttpOnly; Secure; SameSite=Strict; Path=/`.
- Every admin request verifies signature, issuer, audience, and expiry. No refresh — re-login.
- Failures are uniform ("Incorrect password.") regardless of cause, and rate-limited to
  5 / 15 min.
- `SameSite=Strict` plus a JSON-only content type means CSRF has no vector; there is no
  form-encoded admin endpoint.
- The whole admin area is `noindex, nofollow` and `Cache-Control: no-store`.

If `ADMIN_PASSWORD_HASH` is unset, the admin routes return `404` — not `401`. An unconfigured
admin surface should not advertise itself.

## 8. Privacy

| Data | Treatment |
|---|---|
| Source URL | In memory for the request. Persisted only as a salted SHA-256 |
| Destination URL | Returned to the caller; cached with a TTL; **never** written to durable storage |
| Client IP | Salted SHA-256 for limiting and analytics. Never stored raw. Never logged raw |
| User agent | Not stored |
| Cookies | One, admin only. No tracking cookies, no consent banner needed |
| Third parties | None. No analytics, no ads, no CDN-hosted fonts |

`RESOLVE_HASH_SALT` must be ≥ 32 bytes and unique per environment. Rotating it severs every
historical row from any live client — the intended privacy escape hatch.

Logs redact URLs to `scheme://host/…` at `info` and below. Full URLs appear only at `debug`,
which is off in production.

## 9. Supply chain

- Exact versions in `package-lock.json`; `npm ci` everywhere, never `npm install` in CI or
  Docker.
- `npm audit --omit=dev --audit-level=high` blocks the pipeline.
- Ten runtime dependencies, all mainstream and directly justified in [03](./03-tech-stack.md).
- No `postinstall` scripts in the runtime tree.
- Container runs as UID 1001, read-only root filesystem, all capabilities dropped.

## 10. Abuse response

| Signal | Response |
|---|---|
| One client saturating the limit | Automatic `429`. No manual step |
| Distributed abuse from one ASN | `BLOCKED_HOSTS` / upstream WAF rule |
| A destination host repeatedly flagged as malware | Add to `BLOCKED_HOSTS`; resolution returns `BLOCKED_URL` |
| An adapter used to attack one upstream | Disable it from the admin UI; effective on the next request |

## 11. Pre-launch checklist

- [ ] `RESOLVE_HASH_SALT`, `ADMIN_SESSION_SECRET` are unique, ≥ 32 bytes, not in git
- [ ] `ADMIN_PASSWORD_HASH` set; the default is not in use
- [ ] `TRUSTED_PROXY_COUNT` matches the actual proxy depth
- [ ] TLS terminated upstream; HSTS confirmed on a real response
- [ ] `GET /api/v1/resolve` with `http://169.254.169.254/latest/meta-data/` returns `403`
- [ ] Same for `http://127.0.0.1:5432`, `http://[::1]/`, `http://2130706433/`, `file:///etc/passwd`
- [ ] A public URL redirecting to `127.0.0.1` returns `403`, not a fetched body
- [ ] `npm audit --omit=dev` clean at high and above
- [ ] Security headers verified on a production response, not just in code
- [ ] Admin sign-in locks out after 5 attempts
- [ ] Database user has `SELECT`/`INSERT`/`UPDATE`/`DELETE` only — no DDL at runtime
- [ ] Error responses contain no stack traces (`NODE_ENV=production` verified)
- [ ] `/api/metrics` is token-gated or network-restricted
