import type { Metadata } from 'next'
import { PageHeader, Prose } from '@/components/Prose'

export const metadata: Metadata = {
  title: 'About',
  description: 'What Clearway is, how it works, and the principles behind it.',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-14 sm:px-6">
      <PageHeader eyebrow="About" title="A link resolver that shows its work" />
      <Prose>
        <p>
          Clearway takes a link that has been wrapped, shortened, or diverted through a redirect,
          and returns where it actually goes. The difference from the rest of the category is that
          it shows you the whole route — every hop, its status code, and which adapter handled it —
          instead of a single opaque URL.
        </p>

        <h2>How it works</h2>
        <p>
          A resolution is a walk over a chain of URLs. Each step is handled by a small, focused
          adapter: one follows HTTP redirects, one reads a destination out of a wrapper parameter,
          one decodes a base64 payload, one fetches a paste host&apos;s raw endpoint. The engine
          walks from your link to the destination, enforcing time and hop budgets and detecting
          loops, and hands back the chain it took.
        </p>

        <h2>What it resolves</h2>
        <p>
          Clearway ships resolvers for public, standards-based mechanisms — redirect chains,
          meta-refresh and canonical hints, wrapper parameters, base64 payloads, named shorteners,
          and paste hosts. Provider-enforcement bypasses for ad-gates and social-unlock gates are a
          different act with different legal exposure, so they are a documented extension point, not
          a default.
        </p>

        <h2>Principles</h2>
        <ul>
          <li>
            <strong>No account, no quota.</strong> Friction kills a utility. Paste and go.
          </li>
          <li>
            <strong>Nothing readable is stored.</strong> Links and IPs are salted one-way hashes,
            kept only to count usage and health. Destinations are never persisted.
          </li>
          <li>
            <strong>Coverage you can check.</strong> Every service has a public health state,
            computed from real traffic, so you know before you try.
          </li>
          <li>
            <strong>Safe by construction.</strong> Every outbound request passes an SSRF guard;
            private and internal addresses can never be reached.
          </li>
        </ul>
      </Prose>
    </div>
  )
}
