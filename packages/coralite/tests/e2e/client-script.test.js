import { test, expect } from '@playwright/test'

test.describe('Client Script', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client-script/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    try {
      await page.evaluate(() => window.__coralite_ready__)
    } catch (e) {
      await page.waitForTimeout(500)
    }

  })

  test('should execute script, setup context, and test reactivity', async ({ page }) => {
    const host = page.getByTestId('mounted-child')
    const title = host.locator('h2')
    await expect(title).toHaveText('Initial Parent')

    const status = host.locator('p')
    await expect(status).toHaveText('Status: Offline')

    const btn = host.locator('button')
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    await expect(host).toHaveAttribute('data-confetti', 'loaded')
  })
})
