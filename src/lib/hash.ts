import { createHash } from 'node:crypto'
import { env } from './env'

/**
 * Salted, one-way hashing for anything that must be counted but never stored in a
 * reversible form — URLs and client IPs. Rotating RESOLVE_HASH_SALT severs the
 * link between historical rows and any live client. See docs/07-security.md §8.
 */

export function saltedHash(value: string): string {
  return createHash('sha256').update(value).update(env.RESOLVE_HASH_SALT).digest('hex')
}
