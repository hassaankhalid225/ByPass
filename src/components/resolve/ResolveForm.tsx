'use client'

import { AlertTriangle, ClipboardPaste, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { ApiEnvelope, ResolveData } from '@/lib/api/types'
import { clearHistory, pushHistory, readHistory, type HistoryEntry } from '@/lib/history'
import { DestinationSign } from './DestinationSign'
import { RouteStrip } from './RouteStrip'

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; data: ResolveData; requestId: string }
  | { phase: 'error'; message: string; code: string; requestId: string }

export function ResolveForm() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [validationError, setValidationError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [canPaste, setCanPaste] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHistory(readHistory())
    setCanPaste(typeof navigator !== 'undefined' && !!navigator.clipboard?.readText)
  }, [])

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text.trim())
        inputRef.current?.focus()
      }
    } catch {
      setCanPaste(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setValidationError('Paste a link first.')
      inputRef.current?.focus()
      return
    }
    setValidationError(null)
    setState({ phase: 'loading' })

    try {
      const res = await fetch('/api/v1/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const body: ApiEnvelope<ResolveData> = await res.json()

      if (!body.ok) {
        setState({
          phase: 'error',
          message: body.error.message,
          code: body.error.code,
          requestId: body.requestId,
        })
        return
      }

      setState({ phase: 'done', data: body.data, requestId: body.requestId })
      setHistory(
        pushHistory({
          source: body.data.source,
          destination: body.data.destination,
          resolvedAt: body.data.resolvedAt,
        }),
      )
    } catch {
      setState({
        phase: 'error',
        message: 'Could not reach the resolver. Check your connection and try again.',
        code: 'NETWORK',
        requestId: '—',
      })
    }
  }

  function reuse(entry: HistoryEntry) {
    setUrl(entry.source)
    inputRef.current?.focus()
  }

  function onClearHistory() {
    clearHistory()
    setHistory([])
  }

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a link — bit.ly/…, a wrapper, a paste"
              aria-label="Link to resolve"
              aria-invalid={validationError ? true : undefined}
              aria-describedby={validationError ? 'url-error' : undefined}
              className="h-14 w-full rounded-[--radius] border border-[--color-line] bg-[--color-surface] pl-4 pr-28 font-mono text-base text-[--color-road] outline-none placeholder:text-[--color-muted] focus-visible:border-[--color-route]"
            />
            {canPaste && (
              <button
                type="button"
                onClick={paste}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-[--radius] border border-[--color-line] bg-[--color-surface] px-2.5 py-1.5 text-xs font-medium text-[--color-muted] transition-colors duration-120 hover:text-[--color-road]"
              >
                <ClipboardPaste className="size-4" aria-hidden="true" />
                Paste
              </button>
            )}
          </div>
          <Button type="submit" size="lg" loading={state.phase === 'loading'} className="sm:w-auto">
            {state.phase === 'loading' ? 'Resolving' : 'Resolve link'}
          </Button>
        </div>
        {validationError && (
          <p id="url-error" role="alert" className="mt-2 text-sm text-[--color-stop]">
            {validationError}
          </p>
        )}
      </form>

      {/* Result region — announced politely for assistive tech. */}
      <div role="status" aria-live="polite" className="mt-6 empty:mt-0">
        {state.phase === 'done' && (
          <div className="space-y-5">
            <DestinationSign data={state.data} />
            {state.data.chain.length > 1 && (
              <section
                aria-label="Route"
                className="rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-4 sm:p-5"
              >
                <p className="legend mb-4">The route</p>
                <RouteStrip chain={state.data.chain} />
              </section>
            )}
            <p className="text-xs text-[--color-muted]">
              Request <span className="font-mono">{state.requestId}</span>
            </p>
          </div>
        )}
      </div>

      {state.phase === 'error' && (
        <div
          role="alert"
          className="animate-panel-in mt-6 flex items-start gap-3 rounded-[--radius-lg] border border-[--color-stop] bg-[color-mix(in_srgb,var(--color-stop)_8%,var(--color-surface))] p-4"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-[--color-stop]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-medium text-[--color-road]">{state.message}</p>
            <p className="mt-1 text-xs text-[--color-muted]">
              {errorHint(state.code)} · Request <span className="font-mono">{state.requestId}</span>
            </p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section aria-label="Recent" className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <p className="legend">Recent on this device</p>
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 text-xs text-[--color-muted] transition-colors duration-120 hover:text-[--color-stop]"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>
          <ul className="divide-y divide-[--color-line] rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface]">
            {history.map((entry) => (
              <li key={entry.source}>
                <button
                  type="button"
                  onClick={() => reuse(entry)}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors duration-120 hover:bg-[--color-surface-2]"
                >
                  <span className="w-full truncate font-mono text-sm text-[--color-road]">
                    {hostOf(entry.source)}
                  </span>
                  <span className="w-full truncate text-xs text-[--color-muted]">
                    → {hostOf(entry.destination)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function errorHint(code: string): string {
  switch (code) {
    case 'BLOCKED_URL':
      return 'Private and internal addresses cannot be resolved'
    case 'UNSUPPORTED_URL':
      return 'No adapter handles this link yet — tell us about it'
    case 'RATE_LIMITED':
      return 'Slow down for a moment'
    case 'UPSTREAM_TIMEOUT':
      return 'The target was too slow'
    case 'LOOP_DETECTED':
      return 'This link redirects in a circle'
    default:
      return 'Try again, or report it if it keeps happening'
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host + new URL(url).pathname
  } catch {
    return url
  }
}
