'use client'

import { useEffect, useState } from 'react'

/**
 * A draggable bookmarklet that opens Clearway with the current page's URL
 * pre-filled (via /?u=). Built at runtime from the live origin so it always points
 * at the right instance. No cross-origin calls — it just opens the app.
 */
export function Bookmarklet() {
  const [href, setHref] = useState('#')

  useEffect(() => {
    const origin = window.location.origin
    const code = `javascript:(function(){window.open('${origin}/?u='+encodeURIComponent(location.href),'_blank')})()`
    setHref(code)
  }, [])

  return (
    <div className="flex flex-col items-start gap-3 rounded-[--radius-lg] border border-dashed border-[--color-line] bg-[--color-surface] p-5">
      <a
        href={href}
        onClick={(e) => e.preventDefault()}
        draggable
        className="inline-flex items-center gap-2 rounded-[--radius] bg-[--color-sign] px-4 py-2 font-display font-bold text-[--color-sign-ink]"
      >
        Resolve with Clearway
      </a>
      <p className="text-sm text-[--color-muted]">
        Drag this button to your bookmarks bar. On any page, click it to open Clearway with that
        page&apos;s link ready to resolve.
      </p>
    </div>
  )
}
