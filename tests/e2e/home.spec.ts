import { expect, test } from '@playwright/test'

test.describe('Home / resolve flow', () => {
  test('landing page shows the tool above the fold', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('link')
    await expect(page.getByLabel('Link to resolve')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resolve link' })).toBeVisible()
  })

  test('empty submit shows an inline validation message and issues no request', async ({
    page,
  }) => {
    let requested = false
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/resolve')) requested = true
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Resolve link' }).click()
    await expect(page.getByRole('alert')).toContainText('Paste a link first')
    expect(requested).toBe(false)
  })

  test('a blocked URL surfaces a typed, readable error with a request id', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Link to resolve').fill('http://127.0.0.1/')
    await page.getByRole('button', { name: 'Resolve link' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/private|blocked/i)
    await expect(alert).toContainText(/Request/i)
  })
})

test.describe('Theme', () => {
  test('theme toggle persists across reload with no error', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
