import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Client Script', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client-script/')
    await waitForHydration(page)
  })

  test('should execute script, setup context, and test reactivity', async ({ page }) => {
    const comp = page.locator('client-script-component').first()
    const title = comp.locator('h2')
    await expect(title).toHaveText('Initial Parent')

    const status = comp.locator('p')
    await expect(status).toHaveText('Status: Offline')

    const btn = comp.locator('button')
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    const container = comp.locator('div').first()
    await expect(container).toHaveAttribute('data-confetti', 'loaded')

    const dynamicDisplay = comp.locator('div').nth(1)
    await expect(dynamicDisplay).toHaveText('foo', { timeout: 10000 })
  })
})
