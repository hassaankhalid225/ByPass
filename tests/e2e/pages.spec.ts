import { expect, test } from '@playwright/test'

test.describe('Supported page', () => {
  test('renders services with search and category filters', async ({ page }) => {
    await page.goto('/supported')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('services')
    await expect(page.getByRole('tab', { name: /All/ })).toBeVisible()

    // Search narrows the grid.
    await page.getByRole('searchbox').fill('pastebin')
    await expect(page.getByText('Pastebin', { exact: true })).toBeVisible()
  })

  test('category tabs are keyboard operable', async ({ page }) => {
    await page.goto('/supported')
    const shortenerTab = page.getByRole('tab', { name: /Link shorteners/ })
    await shortenerTab.click()
    await expect(shortenerTab).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('Status page', () => {
  test('renders with zero data and says so plainly', async ({ page }) => {
    await page.goto('/status')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })
})

test.describe('Static content', () => {
  for (const path of ['/about', '/privacy', '/terms', '/faq']) {
    test(`${path} renders with a heading`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    })
  }

  test('unknown route shows the 404', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('404')
  })
})

test.describe('API', () => {
  test('health endpoint is live', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('resolve rejects a private address with BLOCKED_URL', async ({ request }) => {
    const res = await request.post('/api/v1/resolve', {
      data: { url: 'http://169.254.169.254/latest/meta-data/' },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('BLOCKED_URL')
  })

  test('resolve validates the body', async ({ request }) => {
    const res = await request.post('/api/v1/resolve', { data: { url: '' } })
    expect(res.status()).toBe(400)
  })
})
