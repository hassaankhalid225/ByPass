import { cn } from '@/lib/cn'

export type StatusTone = 'operational' | 'degraded' | 'down' | 'unavailable'

const tones: Record<StatusTone, { dot: string; text: string; bg: string; label: string }> = {
  operational: {
    dot: 'bg-[--color-sign]',
    text: 'text-[--color-sign]',
    bg: 'bg-[color-mix(in_srgb,var(--color-sign)_12%,transparent)]',
    label: 'Operational',
  },
  degraded: {
    dot: 'bg-[--color-amber]',
    text: 'text-[--color-amber]',
    bg: 'bg-[color-mix(in_srgb,var(--color-amber)_14%,transparent)]',
    label: 'Degraded',
  },
  down: {
    dot: 'bg-[--color-stop]',
    text: 'text-[--color-stop]',
    bg: 'bg-[color-mix(in_srgb,var(--color-stop)_12%,transparent)]',
    label: 'Down',
  },
  unavailable: {
    dot: 'bg-[--color-muted]',
    text: 'text-[--color-muted]',
    bg: 'bg-[color-mix(in_srgb,var(--color-muted)_12%,transparent)]',
    label: 'Not by default',
  },
}

/** Status pill — colour AND a text label, never colour alone (docs §7). */
export function Badge({ tone, children }: { tone: StatusTone; children?: React.ReactNode }) {
  const t = tones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        t.bg,
        t.text,
      )}
    >
      <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden="true" />
      {children ?? t.label}
    </span>
  )
}
