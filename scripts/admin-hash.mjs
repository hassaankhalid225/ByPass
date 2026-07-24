#!/usr/bin/env node
// Generate an ADMIN_PASSWORD_HASH from a password read on stdin (never an argv,
// which would leak into shell history and the process table).
//
// Usage:  echo -n 'your-password' | npm run admin:hash
// Output: scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>   — paste into ADMIN_PASSWORD_HASH.

import { randomBytes, scryptSync } from 'node:crypto'

const N = 16384
const r = 8
const p = 1
const KEYLEN = 64

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
}

const password = await readStdin()
if (!password) {
  console.error('No password on stdin. Usage:  echo -n "pw" | npm run admin:hash')
  process.exit(1)
}
if (password.length < 12) {
  console.error('Password must be at least 12 characters.')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, KEYLEN, { N, r, p })

process.stdout.write(
  `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}\n`,
)
