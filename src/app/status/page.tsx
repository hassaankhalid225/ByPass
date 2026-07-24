import type { Metadata } from 'next'
import { Badge, type StatusTone } from '@/components/ui/Badge'
import { getStatus } from '@/server/status-service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Status',
  description: 'Live system and per-adapter health for Clearway, computed from real traffic.',
}

const SYSTEM_TONE: Record<string, StatusTone> = {
  operational: 'operational',
  degraded: 'degraded',
  down: 'down',
}

export default async function StatusPage() {
  const status = await getStatus()
  const s = status.summary
  const hasData = s.resolutions > 0

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="legend mb-3">System status · last 24h</p>
          <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.02em]">
            {status.status === 'operational'
              ? 'All systems go'
              : status.status === 'degraded'
                ? 'Running with issues'
                : 'Major disruption'}
          </h1>
        </div>
        <Badge tone={SYSTEM_TONE[status.status] ?? 'degraded'} />
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Resolutions" value={hasData ? s.resolutions.toLocaleString() : '—'} />
        <Stat
          label="Success rate"
          value={s.successRate !== null ? `${Math.round(s.successRate * 100)}%` : '—'}
        />
        <Stat label="p95 latency" value={s.p95Ms !== null ? `${s.p95Ms}ms` : '—'} />
        <Stat
          label="Cache hits"
          value={s.cacheHitRate !== null ? `${Math.round(s.cacheHitRate * 100)}%` : '—'}
        />
      </section>

      <h2 className="legend mb-4">Adapters</h2>

      {!hasData && (
        <p className="mb-6 rounded-[--radius] border border-dashed border-[--color-line] p-4 text-sm text-[--color-muted]">
          No traffic in the last 24 hours yet. Health fills in as links are resolved.
        </p>
      )}

      <div className="overflow-x-auto rounded-[--radius-lg] border border-[--color-line]">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[--color-line] bg-[--color-surface-2]">
              <Th>Service</Th>
              <Th>Status</Th>
              <Th className="text-right">Success</Th>
              <Th className="text-right">Samples</Th>
              <Th className="text-right">p95</Th>
            </tr>
          </thead>
          <tbody>
            {status.adapters.map((a) => (
              <tr
                key={a.id}
                className="border-b border-[--color-line] last:border-0 bg-[--color-surface]"
              >
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3">
                  <Badge tone={a.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-[--color-muted]">
                  {a.successRate !== null ? `${Math.round(a.successRate * 100)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[--color-muted]">
                  {a.samples || '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[--color-muted]">
                  {a.p95Ms !== null ? `${a.p95Ms}ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-[--color-muted]">
        Generated {new Date(status.generatedAt).toLocaleString()}. Metrics derive from real traffic
        over a rolling 24-hour window.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-4">
      <p className="legend">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left legend ${className ?? ''}`}>{children}</th>
}
