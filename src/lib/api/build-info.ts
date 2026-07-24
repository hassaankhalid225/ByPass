/** Build metadata surfaced on /api/health and /api/metrics. */
export const BUILD_INFO = {
  version: process.env.npm_package_version ?? '1.0.0',
  commit: process.env.GIT_COMMIT ?? 'dev',
  startedAt: Date.now(),
}

export function uptimeSeconds(): number {
  return Math.floor((Date.now() - BUILD_INFO.startedAt) / 1000)
}
