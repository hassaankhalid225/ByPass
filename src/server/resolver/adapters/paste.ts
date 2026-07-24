import { AppError } from '../../../lib/errors'
import { extractFirstUrl } from '../../../lib/url/extract'
import { defineAdapter } from '../define'
import type { AdapterResult, ResolveContext, ResolverAdapter } from '../types'

/**
 * Paste-host adapters. Each maps a human paste URL to the host's OWN documented
 * raw endpoint, fetches it as text, and returns the first absolute URL found. This
 * is content extraction, not redirection. See docs/06-resolver-engine.md §3.
 */

interface PasteSpec {
  id: string
  name: string
  hosts: string[]
  /** Map a paste URL to its raw-content URL. Return null to decline. */
  toRaw: (url: URL) => string | null
  description: string
}

const PASTES: PasteSpec[] = [
  {
    id: 'pastebin',
    name: 'Pastebin',
    hosts: ['pastebin.com'],
    toRaw: (url) => {
      const id = url.pathname.replace(/^\/(raw\/)?/, '')
      return /^[A-Za-z0-9]{6,12}$/.test(id) ? `https://pastebin.com/raw/${id}` : null
    },
    description: 'Reads the raw contents of a Pastebin paste.',
  },
  {
    id: 'rentry',
    name: 'Rentry',
    hosts: ['rentry.co', 'rentry.org'],
    toRaw: (url) => {
      const id = url.pathname.replace(/^\//, '').replace(/\/$/, '')
      return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? `https://rentry.co/${id}/raw` : null
    },
    description: 'Reads the raw contents of a Rentry paste.',
  },
  {
    id: 'hastebin',
    name: 'Hastebin',
    hosts: ['hastebin.com', 'hasteb.in'],
    toRaw: (url) => {
      const id = url.pathname.replace(/^\/(raw\/)?/, '').split('.')[0]
      return id && /^[A-Za-z0-9]{1,32}$/.test(id) ? `https://hastebin.com/raw/${id}` : null
    },
    description: 'Reads the raw contents of a Hastebin paste.',
  },
  {
    id: 'dpaste',
    name: 'dpaste',
    hosts: ['dpaste.org', 'dpaste.com'],
    toRaw: (url) => {
      const id = url.pathname.replace(/^\//, '').replace(/\.txt$/, '')
      return /^[A-Za-z0-9]{1,32}$/.test(id) ? `https://dpaste.org/${id}.txt` : null
    },
    description: 'Reads the raw contents of a dpaste paste.',
  },
  {
    id: 'paste-ee',
    name: 'Paste.ee',
    hosts: ['paste.ee'],
    toRaw: (url) => {
      const m = /^\/p\/([A-Za-z0-9]+)/.exec(url.pathname)
      return m ? `https://paste.ee/r/${m[1]}` : null
    },
    description: 'Reads the raw contents of a Paste.ee paste.',
  },
  {
    id: 'controlc',
    name: 'ControlC',
    hosts: ['controlc.com', 'anotepad.com'],
    toRaw: (url) => {
      const id = url.pathname.replace(/^\//, '')
      return /^[A-Za-z0-9]{4,16}$/.test(id) ? `https://controlc.com/${id}` : null
    },
    description: 'Reads the contents of a ControlC paste.',
  },
]

async function resolvePaste(
  spec: PasteSpec,
  url: URL,
  ctx: ResolveContext,
): Promise<AdapterResult> {
  const raw = spec.toRaw(url)
  if (!raw) return { kind: 'skip', reason: 'not a recognised paste url' }

  try {
    const res = await ctx.http.get(raw, { accept: 'text/plain,*/*', signal: ctx.signal })
    if (res.status >= 400) {
      return { kind: 'error', code: 'UPSTREAM_ERROR', message: `paste returned ${res.status}` }
    }
    const body = await res.text()
    const found = extractFirstUrl(body)
    if (!found) return { kind: 'skip', reason: 'no url in paste contents' }
    return { kind: 'next', url: found, method: 'html-extract', statusCode: res.status }
  } catch (err) {
    if (AppError.is(err)) return { kind: 'error', code: err.code, message: err.message }
    return { kind: 'error', code: 'UPSTREAM_ERROR', message: 'paste fetch failed' }
  }
}

function makePaste(spec: PasteSpec): ResolverAdapter {
  return defineAdapter({
    id: spec.id,
    name: spec.name,
    category: 'paste',
    hosts: spec.hosts,
    priority: 10,
    listed: true,
    description: spec.description,
    canHandle: (url) => spec.toRaw(url) !== null,
    resolve: (url, ctx) => resolvePaste(spec, url, ctx),
  })
}

/**
 * PrivateBin is listed but declines by design: its payloads are decrypted
 * client-side with a key held in the URL fragment, which never reaches a server.
 * Saying so is better than failing silently. See docs/06-resolver-engine.md §3.
 */
const privatebin: ResolverAdapter = defineAdapter({
  id: 'privatebin',
  name: 'PrivateBin',
  category: 'paste',
  hosts: ['privatebin.net', 'paste.privatebin.info'],
  priority: 10,
  listed: true,
  description: 'PrivateBin pastes are end-to-end encrypted; the key never leaves the browser.',
  canHandle: () => true,
  async resolve() {
    return {
      kind: 'skip',
      reason: 'PrivateBin is end-to-end encrypted; decryption happens only in the browser.',
    }
  },
})

export const pasteAdapters: ResolverAdapter[] = [...PASTES.map(makePaste), privatebin]
