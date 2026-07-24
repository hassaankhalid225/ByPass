import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { adminConfigured, env } from '../../lib/env'

/**
 * Admin authentication. Password verification uses scrypt + timingSafeEqual; the
 * session is a short-lived, signed JWT in an HttpOnly cookie. See
 * docs/07-security.md §7. If admin is not configured, every check fails closed.
 */

// scrypt with an options object: promisify's typings don't cover the 4-arg
// overload, so wrap it explicitly.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err)
      else resolve(derived)
    })
  })
}

export const ADMIN_COOKIE = 'clearway_admin'
const ISSUER = 'clearway'
const AUDIENCE = 'clearway-admin'
const SESSION_TTL = '2h'

/** Parse and verify a password against the stored scrypt hash string. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD_HASH) return false
  const parts = env.ADMIN_PASSWORD_HASH.split('$')
  // Format: scrypt$N$r$p$saltHex$hashHex
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4]!, 'hex')
  const expected = Buffer.from(parts[5]!, 'hex')
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  const derived = (await scrypt(password, salt, expected.length, {
    N,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer

  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

function sessionKey(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_SESSION_SECRET!)
}

export async function createAdminSession(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(SESSION_TTL)
    .setJti(cryptoRandomId())
    .sign(sessionKey())
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!adminConfigured || !token) return false
  try {
    await jwtVerify(token, sessionKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    return true
  } catch {
    return false
  }
}

function cryptoRandomId(): string {
  // 16 random bytes as hex, via Web Crypto (available in Node 20+ and Edge).
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
