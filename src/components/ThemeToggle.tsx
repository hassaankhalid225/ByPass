'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

type Theme = 'system' | 'light' | 'dark'

/** Three-state theme control. Persists to localStorage; applied pre-hydration by
 *  the inline script in the root layout, so there is no flash. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = (localStorage.getItem('clearway:theme') as Theme | null) ?? 'system'
    setTheme(stored)
  }, [])

  function apply(next: Theme) {
    setTheme(next)
    localStorage.setItem('clearway:theme', next)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = next === 'dark' || (next === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', dark)
  }

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'dark', icon: Moon, label: 'Dark' },
  ]

  return (
    <div
      className="inline-flex items-center rounded-full border border-[--color-line] bg-[--color-surface] p-0.5"
      role="group"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => apply(value)}
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full transition-colors duration-120',
            mounted && theme === value
              ? 'bg-[--color-surface-2] text-[--color-road]'
              : 'text-[--color-muted] hover:text-[--color-road]',
          )}
          aria-pressed={mounted && theme === value}
          aria-label={label}
          title={label}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
