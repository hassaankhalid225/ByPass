import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

/** Web app manifest — makes Clearway installable (add to home screen / desktop). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1613',
    theme_color: '#00693e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
