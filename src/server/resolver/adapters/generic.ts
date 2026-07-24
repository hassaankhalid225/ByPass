import { extractBase64Url, extractWrapperParam } from '../../../lib/url/extract'
import { defineAdapter } from '../define'
import { followOne } from '../strategies'
import type { ResolverAdapter } from '../types'

/**
 * Generic technique adapters. Unlisted, low priority, tried last — they cover the
 * long tail without naming a service. See docs/06-resolver-engine.md §3.
 *
 * Query-param and base64 adapters run BEFORE a network fetch (they are pure string
 * transforms), so they get a slightly higher priority than http-redirect.
 */

export const paramsResolver: ResolverAdapter = defineAdapter({
  id: 'params-resolver',
  name: 'Wrapper parameter',
  category: 'generic',
  priority: 30,
  listed: true,
  description: 'Extracts the destination from a redirect wrapper query parameter.',
  canHandle: (url) => extractWrapperParam(url) !== null,
  async resolve(url) {
    const target = extractWrapperParam(url)
    if (!target) return { kind: 'skip', reason: 'no wrapper param' }
    return { kind: 'next', url: target, method: 'query-param' }
  },
})

export const baseResolver: ResolverAdapter = defineAdapter({
  id: 'base-resolver',
  name: 'Base64 payload',
  category: 'generic',
  priority: 25,
  listed: true,
  description: 'Decodes a base64-encoded destination embedded in the path or query.',
  canHandle: (url) => extractBase64Url(url) !== null,
  async resolve(url) {
    const target = extractBase64Url(url)
    if (!target) return { kind: 'skip', reason: 'no base64 payload' }
    return { kind: 'next', url: target, method: 'base64-payload' }
  },
})

export const httpRedirect: ResolverAdapter = defineAdapter({
  id: 'http-redirect',
  name: 'HTTP redirect',
  category: 'generic',
  priority: 0,
  listed: true,
  description:
    'Follows standard HTTP redirects and meta-refresh / canonical hints. The backbone that resolves plain shorteners.',
  // The catch-all. It always claims the URL; the engine only reaches it after
  // host-specific and higher-priority generic adapters have declined.
  canHandle: () => true,
  resolve: (url, ctx) => followOne(url, ctx),
})

export const genericAdapters: ResolverAdapter[] = [paramsResolver, baseResolver, httpRedirect]
