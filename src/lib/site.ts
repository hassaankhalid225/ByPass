/** Site-wide constants and all user-facing copy that is not page-specific. */

export const SITE = {
  name: 'Clearway',
  tagline: 'See where a link really goes.',
  description:
    'Paste a wrapped, shortened, or redirect link and Clearway returns the destination — with every hop it took to get there.',
  url: process.env.APP_URL ?? 'http://localhost:3000',
} as const

export const NAV = [
  { href: '/', label: 'Resolve' },
  { href: '/supported', label: 'Supported' },
  { href: '/status', label: 'Status' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
] as const

export const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/supported', label: 'Supported sites' },
  { href: '/status', label: 'Status' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const
