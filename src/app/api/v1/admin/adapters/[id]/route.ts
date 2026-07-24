import type { NextRequest } from 'next/server'
import { AppError } from '@/lib/errors'
import { getRequestId, parseJsonBody } from '@/lib/api/request'
import { failUnknown, ok } from '@/lib/api/response'
import { AdapterPatchSchema } from '@/lib/api/schemas'
import { requireAdmin } from '@/lib/api/admin-guard'
import { registry } from '@/server/resolver'
import { getStore } from '@/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Enable or disable an adapter at runtime — effective on the next request. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req)
  const meta = { requestId }
  try {
    await requireAdmin(req)
    const { id } = await ctx.params
    if (!registry.get(id)) throw new AppError('NOT_FOUND', 'No such adapter.')

    const body = await parseJsonBody(req)
    const parsed = AdapterPatchSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Expected { enabled: boolean }.')
    }

    const store = await getStore()
    const state = await store.upsertAdapterState(id, {
      enabled: parsed.data.enabled,
      // Re-enabling resets the breaker so the adapter gets a clean chance.
      ...(parsed.data.enabled
        ? { breakerState: 'closed', consecutiveFailures: 0, openedAt: null }
        : {}),
    })

    return ok({ id, enabled: state.enabled, breaker: state.breakerState }, meta)
  } catch (err) {
    return failUnknown(err, meta)
  }
}
