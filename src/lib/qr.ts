import qrcode from 'qrcode-generator'

/**
 * Generate a QR code for a string as a self-contained SVG data URI. Uses the
 * zero-dependency `qrcode-generator`; the SVG is built by hand as one <path> so it
 * is tiny and inlines cleanly under our strict CSP (img-src 'self' data:).
 */
export function qrDataUri(text: string): string {
  // Type 0 = auto-size; error-correction level 'M' balances density and resilience.
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()

  const count = qr.getModuleCount()
  const quiet = 4 // quiet-zone modules on each side
  const size = count + quiet * 2

  let path = ''
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        path += `M${col + quiet} ${row + quiet}h1v1h-1z`
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#0f1613"/>` +
    `</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
