import { defineAdapter } from '../define'
import type { ResolverAdapter } from '../types'

/**
 * Gate adapters — the documented extension point.
 *
 * Ad-gates and social-unlock gates defeat a specific provider's anti-bot, dwell,
 * ad-impression, or social-action enforcement. That is a different act from
 * expanding a redirect, with different legal exposure, so this repository does NOT
 * ship an implementation. See ADR-0005.
 *
 * These entries exist so the categories are represented on /supported (as
 * `unavailable`), and so the engine, health tracking, breaker, admin toggle, and
 * UI slot are all wired for an operator who has the standing to add one: drop a
 * file into this directory implementing `resolve`, and flip `unavailable` off.
 */

interface GateSpec {
  id: string
  name: string
  category: 'ad-gate' | 'social-gate'
  hosts: string[]
}

const GATES: GateSpec[] = [
  {
    id: 'linkvertise',
    name: 'Linkvertise',
    category: 'ad-gate',
    hosts: ['linkvertise.com', 'link-to.net'],
  },
  { id: 'workink', name: 'Work.ink', category: 'ad-gate', hosts: ['work.ink', 'workink.net'] },
  {
    id: 'lootlinks',
    name: 'Lootlinks',
    category: 'ad-gate',
    hosts: ['lootlinks.co', 'lootlink.org'],
  },
  { id: 'adfocus', name: 'AdFocus', category: 'ad-gate', hosts: ['adfoc.us'] },
  { id: 'boostink', name: 'Boost.ink', category: 'ad-gate', hosts: ['boost.ink'] },
  { id: 'mboost', name: 'mboost.me', category: 'ad-gate', hosts: ['mboost.me'] },
  { id: 'shortest', name: 'Shorte.st', category: 'ad-gate', hosts: ['shorte.st', 'sh.st'] },
  { id: 'rekonise', name: 'Rekonise', category: 'social-gate', hosts: ['rekonise.com'] },
  {
    id: 'sub2unlock',
    name: 'Sub2Unlock',
    category: 'social-gate',
    hosts: ['sub2unlock.com', 'sub2unlock.net'],
  },
  { id: 'sub2get', name: 'Sub2Get', category: 'social-gate', hosts: ['sub2get.com'] },
  {
    id: 'socialwolvez',
    name: 'SocialWolvez',
    category: 'social-gate',
    hosts: ['socialwolvez.com'],
  },
]

function makeGate(spec: GateSpec): ResolverAdapter {
  return defineAdapter({
    id: spec.id,
    name: spec.name,
    category: spec.category,
    hosts: spec.hosts,
    priority: 20,
    listed: true,
    unavailable: true,
    description: `${spec.name} gate. Not resolved by default — see the resolver docs.`,
    canHandle: () => true,
    async resolve() {
      return {
        kind: 'error',
        code: 'ADAPTER_DISABLED',
        message: `${spec.name} is not handled by default. See docs/adr/0005 for why.`,
      }
    },
  })
}

export const gateAdapters: ResolverAdapter[] = GATES.map(makeGate)
