'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { BulkResolve } from './BulkResolve'
import { ResolveForm } from './ResolveForm'

type Mode = 'single' | 'bulk'

/** Wraps the single and bulk resolvers behind a small mode toggle. */
export function Resolver() {
  const [mode, setMode] = useState<Mode>('single')

  return (
    <div>
      <div
        className="mb-4 inline-flex rounded-full border border-[--color-line] bg-[--color-surface] p-0.5"
        role="tablist"
        aria-label="Resolve mode"
      >
        {(['single', 'bulk'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-120',
              mode === m
                ? 'bg-[--color-surface-2] text-[--color-road]'
                : 'text-[--color-muted] hover:text-[--color-road]',
            )}
          >
            {m === 'single' ? 'Single link' : 'Bulk'}
          </button>
        ))}
      </div>

      {mode === 'single' ? <ResolveForm /> : <BulkResolve />}
    </div>
  )
}
