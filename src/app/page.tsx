import Link from 'next/link'
import { ArrowRight, Eye, Route, ShieldCheck } from 'lucide-react'
import { Resolver } from '@/components/resolve/Resolver'
import { LiveStats } from '@/components/LiveStats'
import { registry } from '@/server/resolver'

export default function HomePage() {
  const supportedCount = registry.listed().filter((a) => a.category !== 'generic').length

  return (
    <>
      {/* Hero — the tool is the thesis. The form opens above the fold. */}
      <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="legend mb-4 inline-flex items-center gap-2">
            <Route className="size-4 text-[--color-sign]" aria-hidden="true" />
            Link resolver
          </p>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] font-extrabold leading-[0.94] tracking-[-0.03em]">
            See where a link
            <br />
            <span className="text-[--color-sign]">really goes.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[--color-muted]">
            Paste a wrapped, shortened, or redirect link. Clearway returns the destination — and
            shows you every hop it took to get there.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <Resolver />
          <LiveStats />
        </div>
      </section>

      {/* Three quiet supports under the one bold idea. */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <Feature
            icon={Eye}
            title="The route is the result"
            body="Not just the destination — every redirect, wrapper, and paste in between, with its status code and timing."
          />
          <Feature
            icon={ShieldCheck}
            title="Nothing is stored"
            body="No account, no history on our side, no third-party trackers. Links are hashed, never kept in a readable form."
          />
          <Feature
            icon={Route}
            title="Coverage you can check"
            body={`${supportedCount}+ named services plus generic techniques — each with a live health state you can see before you try.`}
          />
        </div>
      </section>

      {/* Coverage CTA — the conversion page is /supported. */}
      <section className="mx-auto max-w-[1200px] px-4 pb-8 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="font-display text-2xl font-bold">Check coverage first</h2>
            <p className="mt-1 max-w-md text-[--color-muted]">
              Every supported service, grouped and searchable, with its current health.
            </p>
          </div>
          <Link
            href="/supported"
            className="inline-flex items-center gap-2 rounded-[--radius] bg-[--color-sign] px-5 py-3 font-display font-bold text-[--color-sign-ink] transition-colors duration-120 hover:bg-[color-mix(in_srgb,var(--color-sign)_88%,black)]"
          >
            Supported sites
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  )
}

function Feature({ icon: Icon, title, body }: { icon: typeof Eye; title: string; body: string }) {
  return (
    <div className="rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] p-6">
      <span className="inline-flex size-10 items-center justify-center rounded-[--radius] bg-[color-mix(in_srgb,var(--color-sign)_12%,transparent)] text-[--color-sign]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[--color-muted]">{body}</p>
    </div>
  )
}
