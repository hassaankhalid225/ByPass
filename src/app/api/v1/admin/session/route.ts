import type { NextRequest } from 'next/server'
import { adminConfigured, isProduction } from '@/lib/env'
import { errors } from '@/lib/errors'
import { getClientIp, getRequestId, parseJsonBody } from '@/lib/api/request'
import { failUnknown, ok } from '@/lib/api/response'
import { AdminLoginSchema } from '@/lib/api/schemas'
import { ADMIN_COOKIE, createAdminSession, verifyAdminPassword } from '@/server/auth/admin'
import { rateLimit } from '@/server/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sign in. Rate-limited hard (5 / 15 min). Uniform error regardless of cause. */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  // Admin unconfigured -> 404, so the surface does not advertise itself.
  if (!adminConfigured) {
    return failUnknown(errors.notFound(), { requestId })
  }

  const rl = await rateLimit('admin-login', getClientIp(req), 5, 15 * 60)
  const meta = { requestId, rateLimit: rl }

  try {
    if (!rl.allowed) return failUnknown(errors.rateLimited(rl.retryAfter), meta)

    const body = await parseJsonBody(req)
    const parsed = AdminLoginSchema.safeParse(body)
    if (!parsed.success) throw errors.unauthorized('Incorrect password.')

    const valid = await verifyAdminPassword(parsed.data.password)
    if (!valid) throw errors.unauthorized('Incorrect password.')

    const token = await createAdminSession()
    const res = ok({ signedIn: true }, meta)
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 2 * 60 * 60,
    })
    return res
  } catch (err) {
    return failUnknown(err, meta)
  }
}

/** Sign out. */
export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req)
  const res = ok({ signedOut: true }, { requestId })
  res.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}
