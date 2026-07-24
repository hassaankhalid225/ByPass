'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Route, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { NAV, SITE } from '@/lib/site'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[--color-line] bg-[color-mix(in_srgb,var(--color-reflect)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2" aria-label={`${SITE.name} home`}>
          <span className="inline-flex size-8 items-center justify-center rounded-[--radius] bg-[--color-sign] text-[--color-sign-ink]">
            <Route className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">{SITE.name}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-[--radius] px-3 py-2 text-sm font-medium transition-colors duration-120',
                  active
                    ? 'bg-[--color-surface-2] text-[--color-road]'
                    : 'text-[--color-muted] hover:text-[--color-road]',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-[--radius] border border-[--color-line] md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-[--color-line] md:hidden" aria-label="Primary mobile">
          <div className="mx-auto max-w-[1200px] px-4 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-[--radius] px-3 py-2.5 text-sm font-medium text-[--color-road] hover:bg-[--color-surface-2]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
