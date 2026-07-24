import type { Metadata } from 'next'
import { PageHeader, Prose } from '@/components/Prose'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms of use for Clearway.',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Terms" title="Terms of use" />
      <Prose>
        <p>
          By using Clearway you agree to these terms. They are intentionally short and written to be
          read.
        </p>

        <h2>What the service does</h2>
        <p>
          Clearway resolves publicly reachable links to their destinations using standards-based
          mechanisms and returns the resulting URL. It does not host, mirror, proxy, or endorse any
          destination content.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>
            Do not use the service to resolve links to private, internal, or unlawful resources.
          </li>
          <li>Do not attempt to overwhelm the service or circumvent its rate limits.</li>
          <li>Do not use the service to violate the rights of any third party.</li>
        </ul>

        <h2>Destinations are third-party content</h2>
        <p>
          A resolved destination is an arbitrary third-party URL. Clearway has no control over it,
          makes no representation about its safety or legality, and is not responsible for it. You
          open destinations at your own discretion and risk.
        </p>

        <h2>No warranty</h2>
        <p>
          The service is provided &quot;as is&quot;, without warranty of any kind. Coverage of any
          particular service may change or break at any time. To the maximum extent permitted by
          law, Clearway is not liable for any damages arising from use of the service.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated. Continued use after a change constitutes acceptance of the
          updated terms.
        </p>
      </Prose>
    </div>
  )
}
