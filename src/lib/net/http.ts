import http from 'node:http'
import https from 'node:https'
import { env } from '../env'
import { AppError, errors } from '../errors'
import { SsrfError, validateOutboundUrl } from './ssrf'

/**
 * The guarded HTTP client — the ONLY egress path in the system.
 *
 * Every request:
 *   - passes through the SSRF guard, which pins a validated IP;
 *   - connects to that pinned IP with Host + TLS SNI set to the original host,
 *     so no second DNS lookup happens (rebinding defence, docs/07-security.md §2.4);
 *   - never follows redirects (redirect: 'manual' semantics) — each hop is
 *     returned to the engine and re-validated;
 *   - caps the body size while streaming and aborts on breach;
 *   - is bounded by a per-instance concurrency semaphore and a timeout.
 *
 * Adapters receive this as `ctx.http`. They never touch node:http or fetch. A
 * lint rule enforces that.
 */

export interface GuardedResponse {
  status: number
  headers: Headers
  url: string
  /** Read the body as text, already size-capped. */
  text(): Promise<string>
}

export interface GetOptions {
  /** Only 'manual' is supported — we never auto-follow. Present for clarity. */
  redirect?: 'manual'
  accept?: string
  signal?: AbortSignal
  method?: 'GET' | 'HEAD'
}

export interface GuardedHttpClient {
  get(url: string | URL, options?: GetOptions): Promise<GuardedResponse>
}

// ── Concurrency semaphore ────────────────────────────────────────────────────
const MAX_CONCURRENT = 32
let active = 0
const queue: Array<() => void> = []

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release(): void {
  active -= 1
  const next = queue.shift()
  if (next) {
    active += 1
    next()
  }
}

// ── The real client ──────────────────────────────────────────────────────────

class NodeGuardedHttpClient implements GuardedHttpClient {
  async get(input: string | URL, options: GetOptions = {}): Promise<GuardedResponse> {
    let target
    try {
      target = await validateOutboundUrl(input)
    } catch (err) {
      // Surface SSRF rejections as a typed, client-safe BLOCKED_URL so the whole
      // chain sees one error type. The specific reason is logged, not returned.
      if (err instanceof SsrfError) {
        throw new AppError('BLOCKED_URL', errors.blockedUrl().message, { cause: err })
      }
      throw err
    }
    await acquire()
    try {
      return await this.request(target, options)
    } finally {
      release()
    }
  }

  private request(
    target: Awaited<ReturnType<typeof validateOutboundUrl>>,
    options: GetOptions,
  ): Promise<GuardedResponse> {
    const isHttps = target.url.protocol === 'https:'
    const transport = isHttps ? https : http
    const method = options.method ?? 'GET'

    const requestOptions: https.RequestOptions = {
      host: target.address, // connect to the pinned IP — NOT the hostname
      port: target.port,
      method,
      path: target.url.pathname + target.url.search,
      headers: {
        Host: target.hostname, // original host for vhosts and the upstream
        'User-Agent': 'ClearwayResolver/1.0 (+https://clearway.example/about)',
        Accept: options.accept ?? 'text/html,application/xhtml+xml,*/*;q=0.8',
        // identity removes the decompression-bomb class entirely (docs §3).
        'Accept-Encoding': 'identity',
        Connection: 'close',
      },
      // For TLS: validate the cert against the real hostname via SNI, even though
      // we dialled the IP. This is what makes the rebinding defence safe on https.
      ...(isHttps ? { servername: target.hostname } : {}),
      timeout: env.STEP_TIMEOUT_MS,
    }

    return new Promise<GuardedResponse>((resolve, reject) => {
      const req = transport.request(requestOptions, (res) => {
        const status = res.statusCode ?? 0

        // We never auto-follow. Redirects come back to the engine.
        const chunks: Buffer[] = []
        let received = 0
        let aborted = false

        res.on('data', (chunk: Buffer) => {
          if (aborted) return
          received += chunk.length
          if (received > env.MAX_RESPONSE_BYTES) {
            aborted = true
            res.destroy()
            req.destroy()
            reject(new AppError('UPSTREAM_ERROR', 'The target response was too large.'))
            return
          }
          chunks.push(chunk)
        })

        res.on('end', () => {
          if (aborted) return
          const bodyBuffer = Buffer.concat(chunks)
          const headers = toHeaders(res.headers)
          resolve({
            status,
            headers,
            url: target.url.toString(),
            text: async () => bodyBuffer.toString('utf8'),
          })
        })

        res.on('error', (err) => {
          if (!aborted) reject(errors.upstream(`response error: ${describe(err)}`))
        })
      })

      const onAbort = () => {
        req.destroy()
        reject(errors.upstreamTimeout())
      }
      if (options.signal) {
        if (options.signal.aborted) {
          req.destroy()
          reject(errors.upstreamTimeout())
          return
        }
        options.signal.addEventListener('abort', onAbort, { once: true })
      }

      req.on('timeout', () => {
        req.destroy()
        reject(errors.upstreamTimeout())
      })

      req.on('error', (err) => {
        if (options.signal) options.signal.removeEventListener('abort', onAbort)
        reject(errors.upstream(`connection error: ${describe(err)}`))
      })

      req.end()
    })
  }
}

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }
  return headers
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'unknown'
}

export const httpClient: GuardedHttpClient = new NodeGuardedHttpClient()
