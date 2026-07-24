#!/usr/bin/env node
// Idempotent, forward-only migration runner. Applied as a DEPLOY STEP, never on
// application boot. Takes an advisory lock so concurrent boots cannot race, then
// applies each unapplied migrations/*.sql in lexical order, each in its own
// transaction. See docs/05-data-model.md §6.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')
const LOCK_KEY = 793058 // arbitrary constant advisory-lock key for clearway migrations

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Nothing to migrate (app will use the in-memory store).')
    process.exit(0)
  }

  const client = new pg.Client({ connectionString })
  await client.connect()

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const applied = new Set(
      (await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    )

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    let count = 0
    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      if (applied.has(version)) continue

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      console.log(`applying ${version} …`)
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
        await client.query('COMMIT')
        count += 1
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${version} failed: ${err.message}`)
      }
    }

    console.log(count === 0 ? 'database is up to date.' : `applied ${count} migration(s).`)
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    await client.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
