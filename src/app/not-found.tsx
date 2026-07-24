import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[600px] flex-col items-center px-4 py-28 text-center sm:px-6">
      <p className="legend mb-4">Wrong exit</p>
      <h1 className="font-display text-[clamp(3rem,10vw,6rem)] font-extrabold leading-none tracking-[-0.03em]">
        404
      </h1>
      <p className="mt-4 max-w-sm text-lg text-[--color-muted]">
        There&apos;s no page here. The link you followed may be broken, or the page may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-[--radius] bg-[--color-sign] px-5 py-3 font-display font-bold text-[--color-sign-ink] transition-colors duration-120 hover:bg-[color-mix(in_srgb,var(--color-sign)_88%,black)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the resolver
      </Link>
    </div>
  )
}
