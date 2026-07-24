import { randomBytes } from 'node:crypto'

/**
 * Request-id generation. The id ties an API response, its log lines, and the DB
 * row together — the single handle support needs. Seedable so tests are
 * deterministic.
 */

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

let counter = 0
let deterministic = false

/** Enable deterministic ids for tests. */
export function useDeterministicIds(on = true): void {
  deterministic = on
  counter = 0
}

export function newRequestId(): string {
  if (deterministic) {
    counter += 1
    return `r_test${counter.toString(16).padStart(8, '0')}`
  }
  return `r_${randomBytes(6).toString('hex')}`
}

/** Accept a client-supplied X-Request-Id only if it is well-formed. */
export function sanitizeRequestId(value: string | null | undefined): string | null {
  if (value && REQUEST_ID_RE.test(value)) return value
  return null
}
