import type { NextRequest } from 'next/server'
import { adminConfigured } from '../env'
import { AppError, errors } from '../errors'
import { ADMIN_COOKIE, verifyAdminSession } from '../../server/auth/admin'

/**
 * Guard for admin API routes. Throws NOT_FOUND when admin is unconfigured (so the
 * surface stays invisible) and UNAUTHORIZED when the session is missing or invalid.
 */
export async function requireAdmin(req: NextRequest): Promise<void> {
  if (!adminConfigured) throw errors.notFound()
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const valid = await verifyAdminSession(token)
  if (!valid) throw new AppError('UNAUTHORIZED', 'Sign in to continue.')
}
