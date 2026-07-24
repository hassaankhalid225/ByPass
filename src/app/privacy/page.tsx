import type { Metadata } from 'next'
import { PageHeader, Prose } from '@/components/Prose'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Clearway collects, what it does not, and how long anything is kept.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Privacy" title="What we keep, and what we don't" />
      <Prose>
        <p>
          Clearway is built to hold as little as possible. There are no accounts, no third-party
          analytics, no advertising scripts, and no tracking cookies. This page describes exactly
          what happens to the data involved in resolving a link.
        </p>

        <h2>Links you submit</h2>
        <p>
          The link you paste is used in memory to perform the resolution. It is never written to
          durable storage in a readable form. For usage counting and health, we store a salted
          SHA-256 hash of the normalised link — enough to count and deduplicate, impossible to
          reverse. Rotating the salt severs any historical record from any current link.
        </p>

        <h2>Destination URLs</h2>
        <p>
          The destination is returned to you and cached briefly so a popular link stays fast. The
          cache has a short time-to-live and is never a durable, reversible record tied to you. Only
          the destination host — not its path or query — is recorded for abuse detection.
        </p>

        <h2>Your IP address</h2>
        <p>
          Your IP is used transiently for rate limiting and is stored, if at all, only as a salted
          one-way hash. It is never logged or stored in raw form.
        </p>

        <h2>Cookies</h2>
        <p>
          The public site sets no cookies. A single cookie exists only for the operator admin area
          and is never set for ordinary visitors.
        </p>

        <h2>Retention</h2>
        <p>
          Hashed usage records are kept for a limited window (30 days by default) purely for health
          and analytics, then deleted. There is no user data to retain, because none is collected.
        </p>

        <h2>Third parties</h2>
        <p>
          None. Fonts are self-hosted, there is no CDN-hosted script, and no request leaves your
          browser to any party other than Clearway itself.
        </p>
      </Prose>
    </div>
  )
}
