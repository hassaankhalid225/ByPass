'use client'

import { useEffect, useState } from 'react'
import type { ApiEnvelope } from '@/lib/api/types'

interface StatusData {
  status: string
  summary: { resolutions: number; successRate: number | null; p95Ms: number | null }
}

/**
 * Live social-proof strip on the home page. Fetches /api/v1/status (cached at the
 * edge) after load, so it never blocks first paint. Renders nothing until there is
 * real traffic to show — an empty stat reads worse than no stat.
 */
export function LiveStats() {
  const [data, setData] = useState<StatusData | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v1/status')
        const body: ApiEnvelope<StatusData> = await res.json()
        if (!cancelled && body.ok) setData(body.data)
      } catch {
        /* non-critical */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data || data.summary.resolutions < 1) return null

  const { resolutions, successRate, p95Ms } = data.summary

  return (
    <p className="mt-8 text-center text-sm text-[--color-muted]">
      <span className="font-mono font-semibold text-[--color-road]">
        {resolutions.toLocaleString()}
      </span>{' '}
      links resolved in the last 24h
      {successRate !== null && (
        <>
          {' · '}
          <span className="font-mono font-semibold text-[--color-sign]">
            {Math.round(successRate * 100)}%
          </span>{' '}
          success
        </>
      )}
      {p95Ms !== null && (
        <>
          {' · '}
          <span className="font-mono font-semibold text-[--color-road]">{p95Ms}ms</span> p95
        </>
      )}
    </p>
  )
}
