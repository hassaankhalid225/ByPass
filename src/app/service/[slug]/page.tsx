import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getServiceBySlug } from '@/server/catalog-service'
import { registry } from '@/server/resolver'
import { SITE } from '@/lib/site'

export const revalidate = 300

/** Indexable per-service landing pages generated from the registry. */
export function generateStaticParams() {
  return registry
    .listed()
    .filter((a) => a.category !== 'generic')
    .map((a) => ({ slug: a.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const service = await getServiceBySlug(slug)
  if (!service) return { title: 'Service not found' }
  return {
    title: `${service.name} link resolver`,
    description:
      `Resolve ${service.name} links with Clearway and see the full destination and every hop. ${service.description ?? ''}`.trim(),
    alternates: { canonical: `${SITE.url}/service/${service.slug}` },
  }
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const service = await getServiceBySlug(slug)
  if (!service) notFound()

  return (
    <div className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <p className="legend">{service.category.replace('-', ' ')}</p>
        <Badge tone={service.status} />
      </div>
      <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold tracking-[-0.02em]">
        {service.name} resolver
      </h1>
      <p className="mt-4 text-lg text-[--color-muted]">
        {service.description ??
          `Paste a ${service.name} link and Clearway returns the destination, with every hop shown.`}
      </p>

      {service.domains.length > 0 && (
        <div className="mt-6">
          <p className="legend mb-2">Handles links from</p>
          <div className="flex flex-wrap gap-2">
            {service.domains.map((d) => (
              <span
                key={d}
                className="rounded-[--radius] border border-[--color-line] bg-[--color-surface] px-2.5 py-1 font-mono text-sm"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {service.status === 'unavailable' && (
        <p className="mt-6 rounded-[--radius] border border-[--color-line] bg-[color-mix(in_srgb,var(--color-amber)_10%,transparent)] p-4 text-sm">
          This gate is not resolved by default. Clearway ships resolvers for public redirects and
          paste hosts; provider-enforcement bypasses are an operator decision. See the resolver
          documentation for the reasoning.
        </p>
      )}

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-[--radius] bg-[--color-sign] px-5 py-3 font-display font-bold text-[--color-sign-ink] transition-colors duration-120 hover:bg-[color-mix(in_srgb,var(--color-sign)_88%,black)]"
      >
        Resolve a link
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
