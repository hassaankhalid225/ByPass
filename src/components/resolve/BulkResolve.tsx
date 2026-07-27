'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import type { ApiEnvelope, BatchData, BatchItemResult } from '@/lib/api/types'

const MAX = 10

/** Bulk mode: paste up to 10 links (one per line) and resolve them all at once. */
export function BulkResolve() {
  const [text, setText] = useState('')
  const [state, setState] = useState<
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'done'; data: BatchData }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const tooMany = lines.length > MAX

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lines.length === 0 || tooMany) return
    setState({ phase: 'loading' })
    try {
      const res = await fetch('/api/v1/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls: lines.slice(0, MAX) }),
      })
      const body: ApiEnvelope<BatchData> = await res.json()
      if (!body.ok) {
        setState({ phase: 'error', message: body.error.message })
        return
      }
      setState({ phase: 'done', data: body.data })
    } catch {
      setState({ phase: 'error', message: 'Could not reach the resolver. Try again.' })
    }
  }

  function allDestinations(data: BatchData): string {
    return data.results
      .filter((r): r is Extract<BatchItemResult, { ok: true }> => r.ok)
      .map((r) => r.destination)
      .join('\n')
  }

  return (
    <div className="w-full">
      <form onSubmit={onSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={'Paste up to 10 links, one per line…\nbit.ly/a\ntinyurl.com/b'}
          aria-label="Links to resolve, one per line"
          className="w-full resize-y rounded-[--radius] border border-[--color-line] bg-[--color-surface] p-4 font-mono text-sm outline-none placeholder:text-[--color-muted] focus-visible:border-[--color-route]"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`text-xs ${tooMany ? 'text-[--color-stop]' : 'text-[--color-muted]'}`}>
            {lines.length}/{MAX} links{tooMany ? ' — too many, first 10 will be used' : ''}
          </span>
          <Button
            type="submit"
            size="lg"
            loading={state.phase === 'loading'}
            disabled={lines.length === 0}
          >
            {state.phase === 'loading'
              ? 'Resolving'
              : `Resolve ${Math.min(lines.length, MAX) || ''}`}
          </Button>
        </div>
      </form>

      {state.phase === 'error' && (
        <div
          role="alert"
          className="animate-panel-in mt-6 flex items-start gap-3 rounded-[--radius-lg] border border-[--color-stop] bg-[color-mix(in_srgb,var(--color-stop)_8%,var(--color-surface))] p-4"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-[--color-stop]"
            aria-hidden="true"
          />
          <p className="text-[--color-road]">{state.message}</p>
        </div>
      )}

      {state.phase === 'done' && (
        <div className="animate-panel-in mt-6 space-y-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between">
            <p className="legend">
              {state.data.results.filter((r) => r.ok).length}/{state.data.count} resolved
            </p>
            <CopyButton value={allDestinations(state.data)} label="Copy all destinations" />
          </div>
          <ul className="divide-y divide-[--color-line] overflow-hidden rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface]">
            {state.data.results.map((r, i) => (
              <li key={`${r.input}-${i}`} className="p-4">
                <p className="truncate font-mono text-xs text-[--color-muted]" title={r.input}>
                  {hostPath(r.input)}
                </p>
                {r.ok ? (
                  <div className="mt-1 flex items-start gap-2">
                    <ArrowRight
                      className="mt-1 size-3.5 shrink-0 text-[--color-sign]"
                      aria-hidden="true"
                    />
                    <a
                      href={r.destination}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="break-all font-mono text-sm text-[--color-route] underline underline-offset-2"
                    >
                      {r.destination}
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[--color-stop]">{r.message}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function hostPath(url: string): string {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    return u.host + u.pathname
  } catch {
    return url
  }
}
