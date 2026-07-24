'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

/** Clipboard write with a confirmed state and a polite live-region announcement. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard unavailable — the value is still selectable in the page. */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[--radius] border border-[--color-line] ' +
          'bg-[--color-surface] px-3 py-1.5 text-sm font-medium text-[--color-road] ' +
          'transition-colors duration-120 hover:bg-[--color-surface-2]',
        className,
      )}
    >
      {copied ? (
        <Check className="size-4 text-[--color-sign]" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span>{copied ? 'Copied' : label}</span>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  )
}
