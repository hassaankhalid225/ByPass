import { cn } from '@/lib/cn'
import { METHOD_LABELS, type HopView } from '@/lib/api/types'

/**
 * The signature element. A resolution rendered as a road: numbered exit markers
 * along a dashed lane, one per hop. Horizontal on desktop, a vertical timeline on
 * mobile. See docs/08-design-system.md §1.
 */
export function RouteStrip({ chain }: { chain: HopView[] }) {
  if (chain.length === 0) return null

  return (
    <div className="relative">
      <ol
        className="flex flex-col gap-0 md:flex-row md:items-start md:gap-0"
        aria-label="Resolution route"
      >
        {chain.map((hop, i) => {
          const isTerminal = hop.method === 'terminal'
          const host = hostOf(hop.url)
          return (
            <li
              key={hop.step}
              className="animate-marker-in relative flex flex-1 gap-3 pb-6 md:flex-col md:gap-2 md:pb-0"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {/* Lane connector */}
              {i < chain.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px border-l border-dashed border-[--color-line] md:left-0 md:top-[11px] md:h-px md:w-full md:border-l-0 md:border-t"
                />
              )}

              <span
                className={cn(
                  'relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isTerminal
                    ? 'bg-[--color-sign] text-[--color-sign-ink]'
                    : 'border border-[--color-line] bg-[--color-surface] text-[--color-road]',
                )}
              >
                {isTerminal ? '✓' : hop.step}
              </span>

              <div className="min-w-0 md:pr-4">
                <p className="truncate font-mono text-sm text-[--color-road]" title={host}>
                  {host}
                </p>
                <p className="legend mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>{METHOD_LABELS[hop.method]}</span>
                  {hop.statusCode !== null && <span>· {hop.statusCode}</span>}
                  {hop.durationMs > 0 && <span>· {hop.durationMs}ms</span>}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
