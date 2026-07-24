import type { Metadata } from 'next'
import { PageHeader } from '@/components/Prose'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'How Clearway works, what it resolves, and what it does with your data.',
}

const FAQS = [
  {
    q: 'What does Clearway do?',
    a: 'You paste a link that is wrapped, shortened, or sitting behind a redirect. Clearway follows it to the destination and shows you every hop it took — the intermediate URLs, their status codes, and which adapter handled each one.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. There is no sign-up, no login, and no quota for resolving links. Paste and go.',
  },
  {
    q: 'What kinds of links can it resolve?',
    a: 'Plain shorteners (bit.ly, TinyURL, is.gd and similar), links that carry the destination in a wrapper parameter or a base64 payload, redirect chains, and paste hosts like Pastebin and Rentry that expose their own raw endpoint. The Supported page lists everything with its current health.',
  },
  {
    q: 'Why did a link fail?',
    a: 'The result tells you why in plain terms — a private or internal address is blocked, a link redirects in a loop, the target timed out, or no adapter handles it yet. Every result and error carries a request ID; include it if you report a problem.',
  },
  {
    q: 'What about ad-gates like Linkvertise or Work.ink?',
    a: 'Those are listed but not resolved by default. Following a redirect is a different act from circumventing a company’s anti-bot and ad-revenue enforcement, which carries different legal exposure. Clearway ships resolvers for public, standards-based mechanisms; the gate categories exist as a documented extension point for an operator who has the standing to add one.',
  },
  {
    q: 'What do you store?',
    a: 'No accounts, no readable URLs, no third-party trackers. Links and IP addresses are stored only as salted one-way hashes, used to count usage and health — never in a form we can reverse. Destination URLs are cached briefly to keep things fast, then expire.',
  },
  {
    q: 'Is there an API?',
    a: 'Yes — a documented, versioned REST API. POST a link to /api/v1/resolve and get a JSON envelope back with the destination and the full hop chain. Rate limits are exposed on standard headers.',
  },
  {
    q: 'Does it store or open the destination for me?',
    a: 'No. Clearway never proxies, mirrors, or auto-opens a destination. It returns the URL as text with a copy control and an explicit link you choose to click.',
  },
]

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-14 sm:px-6">
      <PageHeader eyebrow="Questions" title="Frequently asked" />
      <dl className="divide-y divide-[--color-line] rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface]">
        {FAQS.map((f) => (
          <div key={f.q} className="p-5">
            <dt className="font-display text-lg font-bold">{f.q}</dt>
            <dd className="mt-2 leading-relaxed text-[--color-muted]">{f.a}</dd>
          </div>
        ))}
      </dl>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
