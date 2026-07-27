import { ImageResponse } from 'next/og'
import { SITE } from '@/lib/site'

/**
 * Dynamic Open Graph image for social/chat previews. Rendered on demand by
 * next/og — no external services, no stored assets. Keeps the brand consistent
 * wherever a Clearway link is shared.
 */
export const runtime = 'nodejs'
export const alt = `${SITE.name} — ${SITE.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0f1613',
        color: '#f3f4ef',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: '#22c07a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#07130d',
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          →
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '0.14em' }}>
          {SITE.name.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.03em' }}>
          See where a link
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            color: '#22c07a',
          }}
        >
          really goes.
        </div>
      </div>

      <div style={{ fontSize: 30, color: '#8fa096' }}>
        Resolve shorteners, redirects &amp; paste links — see every hop.
      </div>
    </div>,
    size,
  )
}
