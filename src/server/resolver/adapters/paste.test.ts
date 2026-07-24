import { describe, expect, it } from 'vitest'
import { makeTestContext, textResponse } from '../testing'
import { pasteAdapters } from './paste'

const byId = (id: string) => pasteAdapters.find((a) => a.id === id)!

describe('pastebin adapter', () => {
  it('maps a paste url to raw and extracts the first url', async () => {
    const adapter = byId('pastebin')
    const url = new URL('https://pastebin.com/AbC12345')
    const ctx = makeTestContext({
      responses: {
        'https://pastebin.com/raw/AbC12345': textResponse('grab it here https://dest.test/file'),
      },
    })
    expect(adapter.canHandle(url, ctx)).toBe(true)
    const out = await adapter.resolve(url, ctx)
    expect(out).toMatchObject({ kind: 'next', url: 'https://dest.test/file' })
  })

  it('skips when the paste has no url', async () => {
    const adapter = byId('pastebin')
    const url = new URL('https://pastebin.com/AbC12345')
    const ctx = makeTestContext({
      responses: { 'https://pastebin.com/raw/AbC12345': textResponse('just text, no link') },
    })
    const out = await adapter.resolve(url, ctx)
    expect(out.kind).toBe('skip')
  })
})

describe('privatebin adapter', () => {
  it('declines by design with an explanation', async () => {
    const adapter = byId('privatebin')
    const out = await adapter.resolve(new URL('https://privatebin.net/?abc#key'), makeTestContext())
    expect(out.kind).toBe('skip')
    if (out.kind === 'skip') expect(out.reason).toMatch(/encrypted/i)
  })
})
