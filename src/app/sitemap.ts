import type { MetadataRoute } from 'next'
import { registry } from '@/server/resolver'
import { SITE } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/supported', '/status', '/faq', '/about', '/privacy', '/terms'].map(
    (path) => ({
      url: `${SITE.url}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
    }),
  )

  const serviceRoutes = registry
    .listed()
    .filter((a) => a.category !== 'generic')
    .map((a) => ({
      url: `${SITE.url}/service/${a.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }))

  return [...staticRoutes, ...serviceRoutes]
}
