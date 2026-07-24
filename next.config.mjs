/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  // Keep server-only packages out of the client bundle entirely.
  serverExternalPackages: ['pg', 'ioredis', 'pino'],
  // Security headers live in middleware.ts (they need the per-request CSP nonce).
  // Only static, nonce-independent hardening that must exist even on static assets goes here.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
