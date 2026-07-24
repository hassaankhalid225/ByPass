import { ExternalLink, ShieldAlert } from 'lucide-react'
import { CopyButton } from '@/components/ui/CopyButton'
import type { ResolveData } from '@/lib/api/types'

/**
 * The green result panel, shaped like a motorway exit sign. The destination host is
 * emphasised and the path muted, so a lookalike domain is visible rather than buried.
 * The URL is re-validated as http(s) at render time; a non-web scheme renders as
 * inert text with a warning instead of a link (docs/07-security.md §5, T6).
 */
export function DestinationSign({ data }: { data: ResolveData }) {
  const parts = splitUrl(data.destination)
  const isWeb = parts !== null

  return (
    <div className="animate-panel-in overflow-hidden rounded-[--radius-lg] border-2 border-[--color-sign] bg-[color-mix(in_srgb,var(--color-sign)_6%,var(--color-surface))]">
      <div className="flex items-center justify-between gap-3 border-b border-[--color-line] px-4 py-2">
        <span className="legend text-[--color-sign]">
          {data.status === 'partial' ? 'Furthest hop' : 'Destination'}
        </span>
        <span className="legend">
          {data.hops} {data.hops === 1 ? 'hop' : 'hops'} · {data.durationMs}ms
          {data.cached ? ' · cached' : ''}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {isWeb ? (
          <p className="break-all font-mono text-base leading-relaxed sm:text-lg">
            <span className="text-[--color-muted]">{parts.scheme}://</span>
            <span className="font-medium text-[--color-road]">{parts.host}</span>
            <span className="text-[--color-muted]">{parts.rest}</span>
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-[--radius] bg-[color-mix(in_srgb,var(--color-amber)_12%,transparent)] p-3">
            <ShieldAlert
              className="mt-0.5 size-5 shrink-0 text-[--color-amber]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">This destination is not a web link.</p>
              <p className="mt-1 break-all font-mono text-sm text-[--color-muted]">
                {data.destination}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CopyButton value={data.destination} label="Copy link" />
          {isWeb && (
            <a
              href={data.destination}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 rounded-[--radius] bg-[--color-sign] px-3 py-1.5 text-sm font-bold text-[--color-sign-ink] transition-colors duration-120 hover:bg-[color-mix(in_srgb,var(--color-sign)_88%,black)]"
            >
              Open destination
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
        </div>

        {data.warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {data.warnings.map((w) => (
              <li key={w} className="text-sm text-[--color-amber]">
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function splitUrl(url: string): { scheme: string; host: string; rest: string } | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return {
      scheme: u.protocol.replace(':', ''),
      host: u.host,
      rest: u.pathname + u.search + u.hash,
    }
  } catch {
    return null
  }
}
