'use client'

import { AlertTriangle, Download, FileText, Lock, QrCode, ShieldCheck, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CopyButton } from '@/components/ui/CopyButton'
import type { ApiEnvelope, PreviewData } from '@/lib/api/types'

/**
 * "Know before you click." After a resolve, fetch the destination's preview
 * (title/description/site + HTTPS safety) and a QR code, best-effort. Self-
 * contained: it manages its own fetch so the resolve stays fast.
 */
export function PreviewCard({ destination }: { destination: string }) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    ;(async () => {
      try {
        const res = await fetch('/api/v1/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: destination }),
        })
        const body: ApiEnvelope<PreviewData> = await res.json()
        if (!cancelled && body.ok) setData(body.data)
      } catch {
        /* preview is best-effort */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [destination])

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-4 text-sm text-[--color-muted]">
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading preview…
      </div>
    )
  }

  if (!data) return null

  const markdown = `[${data.title ?? data.finalHost}](${data.url})`

  return (
    <section
      aria-label="Destination preview"
      className="animate-panel-in overflow-hidden rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[--color-line] px-4 py-2">
        <span className="legend">Preview</span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            data.isHttps ? 'text-[--color-sign]' : 'text-[--color-amber]'
          }`}
        >
          {data.isHttps ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          {data.isHttps ? 'Secure (HTTPS)' : 'Not HTTPS'}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-snug">
            {data.title ?? data.siteName ?? data.finalHost}
          </p>
          {data.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-[--color-muted]">
              {data.description}
            </p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[--color-muted]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> {data.finalHost}
            </span>
            {data.contentType && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" /> {data.contentType.split(';')[0]}
              </span>
            )}
          </p>

          {data.flags.length > 0 && (
            <ul className="mt-3 space-y-1">
              {data.flags.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-[--color-amber]">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton value={markdown} label="Copy as Markdown" />
          </div>
        </div>

        {/* QR of the destination. A data-URI SVG — next/image cannot optimize it. */}
        <figure className="flex shrink-0 flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.qr}
            alt={`QR code for ${data.finalHost}`}
            width={112}
            height={112}
            className="size-28 rounded-[--radius] border border-[--color-line] bg-white p-1"
          />
          <a
            href={data.qr}
            download={`clearway-qr-${data.finalHost}.svg`}
            className="inline-flex items-center gap-1 text-xs text-[--color-muted] transition-colors duration-120 hover:text-[--color-road]"
          >
            <Download className="size-3.5" />
            <QrCode className="size-3.5" />
            Save QR
          </a>
        </figure>
      </div>
    </section>
  )
}
