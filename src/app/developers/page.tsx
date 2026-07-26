import type { Metadata } from 'next'
import { Bookmarklet } from '@/components/developers/Bookmarklet'
import { CopyButton } from '@/components/ui/CopyButton'
import { PageHeader } from '@/components/Prose'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Developers',
  description:
    'Clearway’s public REST API: resolve links, preview destinations, and check coverage — with a bookmarklet and copy-paste examples.',
}

const CURL = `curl -sS ${SITE.url}/api/v1/resolve \\
  -H 'content-type: application/json' \\
  -d '{"url":"bit.ly/3xAmPle"}'`

const JS = `const res = await fetch('${SITE.url}/api/v1/resolve', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url }),
})
const body = await res.json()
if (body.ok) console.log(body.data.destination)`

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/resolve',
    desc: 'Resolve a wrapped URL to its destination + hop chain.',
  },
  {
    method: 'POST',
    path: '/api/v1/preview',
    desc: 'Fetch a destination’s title, description, and QR code.',
  },
  { method: 'GET', path: '/api/v1/supported', desc: 'The service registry with live health.' },
  { method: 'GET', path: '/api/v1/status', desc: 'System and per-adapter health.' },
  { method: 'GET', path: '/api/health', desc: 'Liveness / readiness (?deep=1).' },
]

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Developers" title="A public API for resolving links" />
      <p className="mb-10 max-w-2xl text-lg text-[--color-muted]">
        Resolve links from your own code. JSON in, JSON out — with a documented error vocabulary,
        rate-limit headers, and CORS enabled so you can call it from anywhere.
      </p>

      {/* Quick start */}
      <section className="mb-10">
        <h2 className="legend mb-3">Resolve a link — cURL</h2>
        <div className="relative">
          <pre className="overflow-x-auto rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-4 font-mono text-sm">
            {CURL}
          </pre>
          <div className="mt-2">
            <CopyButton value={CURL} label="Copy cURL" />
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="legend mb-3">Resolve a link — JavaScript</h2>
        <pre className="overflow-x-auto rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-4 font-mono text-sm">
          {JS}
        </pre>
        <div className="mt-2">
          <CopyButton value={JS} label="Copy JS" />
        </div>
      </section>

      {/* Endpoints */}
      <section className="mb-10">
        <h2 className="legend mb-3">Endpoints</h2>
        <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-line]">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr
                  key={e.path}
                  className="border-b border-[--color-line] bg-[--color-surface] last:border-0"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="rounded-[--radius-sm] bg-[color-mix(in_srgb,var(--color-route)_14%,transparent)] px-2 py-0.5 font-mono text-xs font-bold text-[--color-route]">
                      {e.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-sm">{e.path}</td>
                  <td className="px-4 py-3 align-top text-[--color-muted]">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-[--color-muted]">
          Rate limits are exposed on <span className="font-mono">X-RateLimit-*</span> headers; a{' '}
          <span className="font-mono">429</span> includes{' '}
          <span className="font-mono">Retry-After</span>. Every response carries a{' '}
          <span className="font-mono">requestId</span>.
        </p>
      </section>

      {/* Bookmarklet */}
      <section>
        <h2 className="legend mb-3">Bookmarklet</h2>
        <Bookmarklet />
      </section>
    </div>
  )
}
