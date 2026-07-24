'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { CategoryView, ServiceView } from '@/server/catalog-service'

/** Client-side search + category filter over the server-rendered service list. */
export function SupportedExplorer({
  services,
  categories,
}: {
  services: ServiceView[]
  categories: CategoryView[]
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((s) => {
      if (active !== 'all' && s.category !== active) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.domains.some((d) => d.includes(q))
      )
    })
  }, [services, query, active])

  const tabs = [{ id: 'all', label: 'All', count: services.length }, ...categories]

  return (
    <div>
      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[--color-muted]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or domain"
          aria-label="Search supported services"
          className="h-11 w-full rounded-[--radius] border border-[--color-line] bg-[--color-surface] pl-10 pr-4 text-sm outline-none placeholder:text-[--color-muted] focus-visible:border-[--color-route]"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-120',
              active === tab.id
                ? 'border-[--color-sign] bg-[color-mix(in_srgb,var(--color-sign)_12%,transparent)] text-[--color-sign]'
                : 'border-[--color-line] text-[--color-muted] hover:text-[--color-road]',
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[--radius-lg] border border-dashed border-[--color-line] p-10 text-center text-[--color-muted]">
          No services match “{query}”. Try a different name or domain.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((service) => (
            <li
              key={service.id}
              className="rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-bold">{service.name}</p>
                  <p className="legend mt-0.5">{categoryLabel(service.category)}</p>
                </div>
                <Badge tone={service.status} />
              </div>
              {service.domains.length > 0 && (
                <p
                  className="mt-3 truncate font-mono text-xs text-[--color-muted]"
                  title={service.domains.join(', ')}
                >
                  {service.domains.join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    shortener: 'Shortener',
    paste: 'Paste host',
    'ad-gate': 'Ad gate',
    'social-gate': 'Social gate',
    generic: 'Generic technique',
  }
  return labels[category] ?? category
}
