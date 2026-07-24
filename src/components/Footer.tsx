import Link from 'next/link'
import { FOOTER_LINKS, SITE } from '@/lib/site'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-24 border-t border-[--color-line]">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-base font-bold">{SITE.name}</p>
            <p className="mt-1 text-sm text-[--color-muted]">{SITE.description}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[--color-muted] transition-colors duration-120 hover:text-[--color-road]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-[--color-line] pt-6 text-xs text-[--color-muted] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.name}. Resolves public redirects and paste hosts.
          </p>
          <p>Not affiliated with any linked service. No content is proxied or stored.</p>
        </div>
      </div>
    </footer>
  )
}
