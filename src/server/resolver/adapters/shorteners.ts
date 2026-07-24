import { defineAdapter } from '../define'
import { followOne } from '../strategies'
import type { ResolverAdapter } from '../types'

/**
 * Named shortener adapters. Each declares its hosts so /supported can name it and
 * health is tracked per service, then delegates to the shared redirect strategy. A
 * service-specific quirk has an obvious home here. See docs/06-resolver-engine.md §3.
 */

interface ShortenerSpec {
  id: string
  name: string
  hosts: string[]
  description: string
}

const SHORTENERS: ShortenerSpec[] = [
  {
    id: 'bitly',
    name: 'Bitly',
    hosts: ['bit.ly', 'bitly.com', 'j.mp'],
    description: 'Expands Bitly short links.',
  },
  { id: 'tinyurl', name: 'TinyURL', hosts: ['tinyurl.com'], description: 'Expands TinyURL links.' },
  { id: 'is-gd', name: 'is.gd', hosts: ['is.gd'], description: 'Expands is.gd links.' },
  { id: 'v-gd', name: 'v.gd', hosts: ['v.gd'], description: 'Expands v.gd links.' },
  {
    id: 'rebrandly',
    name: 'Rebrandly',
    hosts: ['rebrand.ly'],
    description: 'Expands Rebrandly links.',
  },
  {
    id: 'shortio',
    name: 'Short.io',
    hosts: ['short.io', 'kutt.it'],
    description: 'Expands Short.io links.',
  },
  { id: 'cuttly', name: 'Cuttly', hosts: ['cutt.ly'], description: 'Expands Cuttly links.' },
  {
    id: 'tinylink',
    name: 'TinyLink',
    hosts: ['tinylink.onl'],
    description: 'Expands TinyLink links.',
  },
  {
    id: 'google-redirect',
    name: 'Google redirect',
    hosts: ['google.com', 'www.google.com'],
    description: 'Unwraps Google /url?q= redirect links.',
  },
]

function makeShortener(spec: ShortenerSpec): ResolverAdapter {
  return defineAdapter({
    id: spec.id,
    name: spec.name,
    category: 'shortener',
    hosts: spec.hosts,
    priority: 10,
    listed: true,
    description: spec.description,
    // Google only redirects from its /url path; everything else claims any path.
    canHandle: (url) => (spec.id === 'google-redirect' ? url.pathname === '/url' : true),
    resolve: (url, ctx) => followOne(url, ctx),
  })
}

export const shortenerAdapters: ResolverAdapter[] = SHORTENERS.map(makeShortener)
