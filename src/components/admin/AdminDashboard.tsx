'use client'

import { useEffect, useState } from 'react'
import { LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { Badge, type StatusTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface AdminAdapter {
  id: string
  name: string
  category: string
  enabled: boolean
  breaker: 'closed' | 'open' | 'half-open'
  unavailable: boolean
  samples: number
  successRate: number | null
  p95Ms: number | null
  lastFailureAt: string | null
}

type View =
  | { phase: 'loading' }
  | { phase: 'unauth' }
  | { phase: 'ready'; adapters: AdminAdapter[] }
  | { phase: 'error'; message: string }

export function AdminDashboard() {
  const [view, setView] = useState<View>({ phase: 'loading' })
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await fetch('/api/v1/admin/adapters')
    if (res.status === 401) {
      setView({ phase: 'unauth' })
      return
    }
    if (res.status === 404) {
      setView({ phase: 'error', message: 'Admin is not configured on this instance.' })
      return
    }
    const body = await res.json()
    if (body.ok) setView({ phase: 'ready', adapters: body.data.adapters })
    else setView({ phase: 'error', message: body.error.message })
  }

  useEffect(() => {
    void load()
  }, [])

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/v1/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = await res.json()
      if (body.ok) {
        setPassword('')
        setView({ phase: 'loading' })
        await load()
      } else {
        setLoginError(body.error.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await fetch('/api/v1/admin/session', { method: 'DELETE' })
    setView({ phase: 'unauth' })
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/v1/admin/adapters/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    await load()
  }

  async function purge() {
    await fetch('/api/v1/admin/cache/purge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
  }

  if (view.phase === 'loading') {
    return <p className="text-[--color-muted]">Loading…</p>
  }

  if (view.phase === 'error') {
    return (
      <p className="rounded-[--radius] border border-[--color-line] bg-[--color-surface] p-4 text-[--color-muted]">
        {view.message}
      </p>
    )
  }

  if (view.phase === 'unauth') {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
        <p className="mt-1 text-sm text-[--color-muted]">Operator access only.</p>
        <form onSubmit={signIn} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Admin password"
            autoComplete="current-password"
            className="h-11 w-full rounded-[--radius] border border-[--color-line] bg-[--color-surface] px-3 outline-none focus-visible:border-[--color-route]"
          />
          {loginError && (
            <p role="alert" className="text-sm text-[--color-stop]">
              {loginError}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Adapters</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void purge()}>
            <Trash2 className="size-4" aria-hidden="true" />
            Purge cache
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[--radius-lg] border border-[--color-line]">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[--color-line] bg-[--color-surface-2]">
              <th className="legend px-4 py-2.5 text-left">Adapter</th>
              <th className="legend px-4 py-2.5 text-left">State</th>
              <th className="legend px-4 py-2.5 text-right">Success</th>
              <th className="legend px-4 py-2.5 text-right">Samples</th>
              <th className="legend px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {view.adapters.map((a) => (
              <tr
                key={a.id}
                className="border-b border-[--color-line] bg-[--color-surface] last:border-0"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{a.name}</p>
                  <p className="legend mt-0.5">{a.category}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stateTone(a)}>{stateLabel(a)}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[--color-muted]">
                  {a.successRate !== null ? `${Math.round(a.successRate * 100)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[--color-muted]">
                  {a.samples || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {!a.unavailable && (
                    <Button
                      variant={a.enabled ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => void toggle(a.id, !a.enabled)}
                    >
                      {a.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function stateTone(a: AdminAdapter): StatusTone {
  if (a.unavailable) return 'unavailable'
  if (!a.enabled || a.breaker === 'open') return 'down'
  if (a.breaker === 'half-open') return 'degraded'
  return 'operational'
}

function stateLabel(a: AdminAdapter): string {
  if (a.unavailable) return 'Extension point'
  if (!a.enabled) return 'Disabled'
  if (a.breaker === 'open') return 'Breaker open'
  if (a.breaker === 'half-open') return 'Recovering'
  return 'Enabled'
}
