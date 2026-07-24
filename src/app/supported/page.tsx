import type { Metadata } from 'next'
import { SupportedExplorer } from '@/components/supported/SupportedExplorer'
import { getSupported } from '@/server/catalog-service'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Supported sites',
  description:
    'Every service Clearway can resolve — shorteners, paste hosts, and generic techniques — grouped, searchable, and shown with live health.',
}

export default async function SupportedPage() {
  const { total, categories, services } = await getSupported()

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
      <header className="mb-8 max-w-2xl">
        <p className="legend mb-3">Coverage</p>
        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em]">
          {total} services and counting
        </h1>
        <p className="mt-4 text-lg text-[--color-muted]">
          A custom resolver engine skips shorteners, wrapper links, and paste hosts in seconds. Each
          entry shows its current health, so you know before you try.
        </p>
      </header>

      <SupportedExplorer services={services} categories={categories} />
    </div>
  )
}
